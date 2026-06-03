"""LLM provider 폴백 체인 — Claude → Gemini → ChatGPT → Grok.

각 provider 공통 인터페이스:
    def chat(system: str, user: str) -> str

호출부는 call_with_fallback(system, user) 만 쓰면 됨.
401/402/429/quota·credit·키 미설정 → 다음 provider로.
다른 예외(네트워크 등)는 1회 재시도 후 다음으로.
"""
import os
import time
from typing import Optional, Tuple


def _is_fallback_error(exc: Exception) -> bool:
    """API 키·결제·한도 관련이면 True → 다음 provider로 폴백"""
    s = str(exc).lower()
    keywords = [
        "401", "403", "402", "429",
        "invalid x-api-key", "invalid_api_key", "authentication",
        "credit", "quota", "insufficient", "exceeded",
        "billing", "payment", "rate limit", "rate_limit",
        "permission", "unauthorized",
    ]
    return any(k in s for k in keywords)


# ───── Anthropic Claude ─────
def _call_anthropic(system: str, user: str) -> str:
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY 미설정")
    from anthropic import Anthropic
    client = Anthropic(api_key=key)
    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
    msg = client.messages.create(
        model=model,
        max_tokens=4000,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    text = ""
    for block in msg.content:
        if getattr(block, "type", None) == "text":
            text += block.text
    return text


# ───── Google Gemini (google-genai SDK) ─────
def _call_gemini(system: str, user: str) -> str:
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        raise RuntimeError("GEMINI_API_KEY 미설정")
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=key)
    model_name = os.environ.get("GEMINI_MODEL", "gemini-2.5-pro")
    resp = client.models.generate_content(
        model=model_name,
        contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.4,
            max_output_tokens=4000,
        ),
    )
    text = getattr(resp, "text", "") or ""
    if text:
        return text
    cands = getattr(resp, "candidates", []) or []
    if cands and getattr(cands[0], "content", None):
        parts = cands[0].content.parts or []
        return "".join(getattr(p, "text", "") for p in parts)
    return ""


# ───── OpenAI ChatGPT ─────
def _call_openai(system: str, user: str) -> str:
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key:
        raise RuntimeError("OPENAI_API_KEY 미설정")
    from openai import OpenAI
    client = OpenAI(api_key=key)
    model = os.environ.get("OPENAI_MODEL", "gpt-4.1")
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.4,
        max_tokens=4000,
    )
    return resp.choices[0].message.content or ""


# ───── xAI Grok (OpenAI 호환) ─────
def _call_grok(system: str, user: str) -> str:
    key = os.environ.get("GROK_API_KEY", "")
    if not key:
        raise RuntimeError("GROK_API_KEY 미설정")
    from openai import OpenAI
    base_url = os.environ.get("GROK_BASE_URL", "https://api.x.ai/v1")
    client = OpenAI(api_key=key, base_url=base_url)
    model = os.environ.get("GROK_MODEL", "grok-3")
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.4,
        max_tokens=4000,
    )
    return resp.choices[0].message.content or ""


PROVIDERS = {
    "anthropic": _call_anthropic,
    "gemini": _call_gemini,
    "openai": _call_openai,
    "grok": _call_grok,
}


def _order() -> list:
    raw = os.environ.get("LLM_FALLBACK_ORDER", "anthropic,gemini,openai,grok")
    return [p.strip() for p in raw.split(",") if p.strip() in PROVIDERS]


def call_with_fallback(system: str, user: str, log=print) -> Tuple[str, str]:
    """폴백 순서대로 시도. 반환: (응답 텍스트, 사용된 provider 이름).
    모든 provider 실패 시 마지막 예외 raise.
    """
    last_exc: Optional[Exception] = None
    for name in _order():
        fn = PROVIDERS[name]
        try:
            log(f"[llm] {name} 시도")
            text = fn(system, user)
            if text and text.strip():
                log(f"[llm] {name} 성공 ({len(text)} chars)")
                return text, name
            log(f"[llm] {name} 빈 응답 — 폴백")
        except Exception as e:
            last_exc = e
            fallback = _is_fallback_error(e)
            log(f"[llm] {name} 실패: {type(e).__name__}: {str(e)[:200]} {'(폴백)' if fallback else '(예상치 못한 오류 — 다음으로)'}")
            # 폴백 사유든 일반 오류든 다음 provider 시도
            continue
    if last_exc:
        raise RuntimeError(f"모든 LLM provider 실패. 마지막: {last_exc}") from last_exc
    raise RuntimeError("LLM provider가 하나도 설정되지 않음 (.env에 키 1개는 필요)")
