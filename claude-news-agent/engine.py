"""LLM 폴백 호출 + self_critique 자가평가.

- translate_article(article): 폴백 체인 (Claude→Gemini→GPT→Grok)으로 번역·재구성 → 한글 결과 + JSON 채점
- self_critique: 1~5점, ≤2면 1회 재생성
- marketing_filter 위반 시 점수 강제 2 이하
"""
import json
import os
import re
import sys
import time
from typing import Dict, Tuple, Optional

import marketing_filter
import llm_providers

PUBLISH_THRESHOLD = int(os.environ.get("PUBLISH_THRESHOLD", "3"))
MAX_RETRIES = 1

SKILL_INSTRUCTION_PATH = os.path.join(
    os.path.dirname(__file__), "skills", "Claude새소식", "SKILL.md"
)


def _load_skill_instruction() -> str:
    try:
        with open(SKILL_INSTRUCTION_PATH, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""


SKILL_INSTRUCTION = _load_skill_instruction()


def _log(msg: str):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


# ───── 마크다운 → plain text 안전망 ─────
# WAAT는 마크다운을 렌더링하지 않으므로 모델이 SKILL.md를 어겨 마크다운 문법을 내놓으면
# 사용자 화면에 #·*가 그대로 보인다. 게시 직전 정제.
_MD_HEADER_RE = re.compile(r"^\s{0,3}#{1,6}\s+", re.MULTILINE)
_MD_BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
_MD_ITALIC_RE = re.compile(r"(?<![\*\w])\*([^\*\n]+?)\*(?!\*)")
_MD_CODEFENCE_RE = re.compile(r"```[a-zA-Z0-9_-]*\n([\s\S]*?)```", re.MULTILINE)
_MD_INLINE_CODE_RE = re.compile(r"`([^`\n]+?)`")
_MD_LINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^\)\s]+)\)")
_MD_BLOCKQUOTE_RE = re.compile(r"^\s*>\s?", re.MULTILINE)
_MD_HR_RE = re.compile(r"^\s*(?:-{3,}|\*{3,}|_{3,})\s*$", re.MULTILINE)


def strip_markdown(text: str) -> str:
    if not text:
        return text
    s = text
    s = _MD_CODEFENCE_RE.sub(lambda m: m.group(1), s)
    s = _MD_INLINE_CODE_RE.sub(lambda m: m.group(1), s)
    s = _MD_HEADER_RE.sub("", s)
    s = _MD_BOLD_RE.sub(lambda m: m.group(1), s)
    s = _MD_ITALIC_RE.sub(lambda m: m.group(1), s)
    s = _MD_LINK_RE.sub(lambda m: f"{m.group(1)} ({m.group(2)})", s)
    s = _MD_BLOCKQUOTE_RE.sub("", s)
    s = _MD_HR_RE.sub("", s)
    # 본문 줄 앞 "* " 또는 "+ " 불릿을 "· "로 정규화 (- 는 유지)
    s = re.sub(r"^\s*\*\s+", "· ", s, flags=re.MULTILINE)
    s = re.sub(r"^\s*\+\s+", "· ", s, flags=re.MULTILINE)
    # 연속 3줄 이상 빈 줄 → 2줄
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def find_markdown_violations(text: str) -> list:
    hits = []
    if _MD_HEADER_RE.search(text or ""):
        hits.append("헤더(#)")
    if _MD_BOLD_RE.search(text or ""):
        hits.append("굵게(**)")
    if _MD_ITALIC_RE.search(text or ""):
        hits.append("기울임(*)")
    if _MD_CODEFENCE_RE.search(text or ""):
        hits.append("코드펜스(```)")
    if _MD_INLINE_CODE_RE.search(text or ""):
        hits.append("인라인코드(`)")
    if _MD_LINK_RE.search(text or ""):
        hits.append("마크다운 링크([]())")
    if _MD_BLOCKQUOTE_RE.search(text or ""):
        hits.append("인용(>)")
    if _MD_HR_RE.search(text or ""):
        hits.append("가로줄(---)")
    return hits


def _build_user_prompt(article: Dict) -> str:
    body = (article.get("body_text") or "")[:12000]
    images_info = ""
    if article.get("images"):
        images_info = "\n\n원문 이미지 (alt 텍스트):\n" + "\n".join(
            f"- {i+1}. {im.get('alt','(no alt)')}" for i, im in enumerate(article["images"][:5])
        )
    return f"""아래는 Anthropic 공식 사이트의 영문 글입니다. SKILL.md에 정의된 형식대로 한국어 게시글을 작성하세요.

---원문 메타---
URL: {article.get('url','')}
제목: {article.get('title','')}
발행일: {article.get('published_at','(미상)')}
{images_info}

---원문 본문---
{body}

---출력 지시---
1) 먼저 SKILL.md 형식대로 한국어 게시글 본문(마크다운)을 작성하세요.
2) 본문 작성이 끝난 뒤, 빈 줄 두 줄을 두고 `<<<CRITIQUE>>>` 토큰 다음 줄에 자가평가 JSON 단 하나만 출력하세요.

자가평가 JSON 스키마:
{{
  "score": 1~5 정수,
  "reasons": ["채점 근거 1", "근거 2"],
  "marketing_violations": ["적발한 표현 (없으면 빈 배열)"],
  "should_publish": true/false
}}

규칙:
- 마케팅 표현(혁신적·획기적·놀라운·게임 체인저 등)이 본문에 1건이라도 있으면 score ≤ 2
- 한국 독자가 처음 보는 영문 용어는 첫 등장 시 한국어 풀이
- 사실 진술만, 추측은 "원문에서 ~로 추정" 명시
"""


def _split_body_critique(text: str) -> Tuple[str, Optional[dict]]:
    """모델 응답을 본문 / JSON으로 분리"""
    if "<<<CRITIQUE>>>" in text:
        body, _, tail = text.partition("<<<CRITIQUE>>>")
        body = body.strip()
        critique_str = tail.strip()
    else:
        # 폴백: 마지막 ``` JSON 블록 또는 마지막 { ... } 추출 시도
        body = text.strip()
        critique_str = ""
        m = re.search(r"```json\s*(\{[\s\S]*?\})\s*```", text)
        if m:
            critique_str = m.group(1)
            body = text[:m.start()].strip()
        else:
            m = re.search(r"(\{[\s\S]*\"score\"[\s\S]*\})\s*$", text)
            if m:
                critique_str = m.group(1)
                body = text[:m.start()].strip()

    critique = None
    if critique_str:
        # 코드 펜스 제거
        cs = critique_str.strip()
        cs = re.sub(r"^```(?:json)?", "", cs).strip()
        cs = re.sub(r"```$", "", cs).strip()
        try:
            critique = json.loads(cs)
        except Exception:
            # 첫 { ... 마지막 } 사이만 추출
            i, j = cs.find("{"), cs.rfind("}")
            if i != -1 and j != -1 and j > i:
                try:
                    critique = json.loads(cs[i:j+1])
                except Exception:
                    critique = None
    return body, critique


def _enforce_marketing_floor(body: str, critique: dict) -> dict:
    """본문에 마케팅 표현 또는 마크다운 문법이 있으면 점수 강제 2 이하"""
    mkt_hits = marketing_filter.find_violations(body)
    md_hits = find_markdown_violations(body)
    if (mkt_hits or md_hits) and critique.get("score", 5) > 2:
        critique["score"] = 2
        critique["should_publish"] = False
        reasons = critique.setdefault("reasons", [])
        if mkt_hits:
            reasons.append(f"marketing_filter 자동 감점: {marketing_filter.report(body)}")
            critique["marketing_violations"] = list({h["match"] for h in mkt_hits})
        if md_hits:
            reasons.append(f"마크다운 문법 검출 (사용자에게 raw 문자 노출): {', '.join(md_hits)}")
            critique["markdown_violations"] = md_hits
    return critique


def _call_model(article: Dict, system_extra: str = "") -> Tuple[str, Optional[dict], str]:
    """반환: (본문, 자가평가 dict, 사용된 provider 이름)"""
    system = (SKILL_INSTRUCTION + "\n\n" + system_extra).strip()
    text, provider = llm_providers.call_with_fallback(
        system=system,
        user=_build_user_prompt(article),
        log=_log,
    )
    body, critique = _split_body_critique(text)
    return body, critique, provider


def translate_article(article: Dict) -> Dict:
    """원문 → 한글 본문 + 자가평가.

    반환: {
      'body': str,
      'critique': dict,
      'attempts': int,
      'final_decision': 'publish' | 'hold',
      'provider': str,             # 실제 사용된 LLM provider
    }
    """
    body, critique, provider = _call_model(article)
    attempts = 1

    if not critique:
        critique = {
            "score": 0,
            "reasons": ["self_critique JSON 파싱 실패"],
            "marketing_violations": [],
            "should_publish": False,
        }
    else:
        critique = _enforce_marketing_floor(body, critique)

    if critique.get("score", 0) <= 2 and attempts < (1 + MAX_RETRIES):
        retry_hint = (
            "이전 시도가 자가평가 2점 이하였습니다. 다음을 수정하여 다시 작성하세요:\n"
            f"- 사유: {critique.get('reasons', [])}\n"
            f"- 마케팅 표현 적발: {critique.get('marketing_violations', [])}\n"
            f"- 마크다운 문법 적발: {critique.get('markdown_violations', [])}\n"
            "마케팅 톤 완전 제거 + 사실 진술만 + 한국 독자 풀이 강화 + 마크다운 문법(#,**,*,`,---,>,[]()) 절대 사용 금지."
        )
        body2, critique2, provider2 = _call_model(article, system_extra=retry_hint)
        attempts += 1
        if critique2:
            critique2 = _enforce_marketing_floor(body2, critique2)
            if critique2.get("score", 0) > critique.get("score", 0):
                body, critique, provider = body2, critique2, provider2

    # 마지막 안전망: 모델이 SKILL.md를 어기고 마크다운을 내놨어도 사용자 화면에 # · * 노출 방지
    body = strip_markdown(body)

    decision = "publish" if (critique.get("should_publish") and critique.get("score", 0) >= PUBLISH_THRESHOLD) else "hold"

    return {
        "body": body,
        "critique": critique,
        "attempts": attempts,
        "final_decision": decision,
        "provider": provider,
    }


# ───── 후보 다건 중 1개 선택 ─────
def select_one(candidates: list, log=_log) -> Optional[Dict]:
    """후보 글들 중 한국 독자가 가장 궁금해할 1건을 LLM에게 선정시킨다.
    각 후보는 {url, title, source(news|research), published_at?} 형태.
    반환: 선택된 후보 dict 또는 None (LLM 실패 시 첫 번째 반환).
    """
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]

    numbered = "\n".join(
        f"[{i+1}] ({c.get('source','?')}) {c.get('title','')} — {c.get('url','')}"
        for i, c in enumerate(candidates)
    )
    system = (
        "당신은 한국 독자 대상 Anthropic 새 소식 큐레이터입니다. "
        "여러 영문 글 제목 중 한국 사용자가 가장 궁금해할 1건을 고르세요.\n"
        "우선순위:\n"
        "1) 한국 사용자가 실제 써볼 수 있는 신규 제품·기능·모델 출시\n"
        "2) 사용 방법·가격·접근 경로가 명시될 가능성이 높은 글\n"
        "3) 한국 IT 종사자가 업무에 바로 적용 가능한 사례·튜토리얼\n"
        "4) 안전·정책 발표 (실용성 낮으면 후순위)\n"
        "5) 사내 행사·인사 소식은 선택하지 않음\n"
        "동률이면 발행일 최신 글을 우선."
    )
    user = (
        "다음 후보 중 위 기준으로 1번만 골라 JSON으로 답하세요:\n\n"
        + numbered
        + '\n\n응답 형식 단 하나만:\n{"pick": <후보 번호>, "reason": "<한 줄 사유>"}'
    )
    try:
        text, provider = llm_providers.call_with_fallback(system=system, user=user, log=log)
        log(f"[select] provider={provider} 응답={text[:200]}")
        m = re.search(r"\{[^{}]*\"pick\"[^{}]*\}", text)
        if not m:
            raise ValueError("JSON not found in response")
        obj = json.loads(m.group(0))
        idx = int(obj.get("pick", 1)) - 1
        if 0 <= idx < len(candidates):
            chosen = candidates[idx]
            log(f"[select] #{idx+1} 선정: {chosen.get('title','')[:80]} (사유: {obj.get('reason','')})")
            return chosen
    except Exception as e:
        log(f"[select] LLM 선택 실패 — 첫 후보로 폴백: {e}")
    return candidates[0]
