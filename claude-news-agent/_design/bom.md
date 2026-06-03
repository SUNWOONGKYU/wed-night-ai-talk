---
title: "BOM — claude-news-agent Phase 4 산출물"
created: 2026-05-28
phase: 4
agent: claude-news-agent
---

# 📦 BOM — Bill of Materials (claude-news-agent)

> 단일 모드 + 인프라 B (DB 없음·.py+API키). 🔵 공통 인프라는 단일 모드라 N/A.

---

## 4-1. 5대 KPI 채점 (후보별)

| 후보 | 명료성 | 운용충돌 | 최신성 | 의존성 | 검증가능성 | **종합** |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `anthropic` 0.104.1 | ✅ | 0 | 5일 전 | ✅ 단일 | ✅ | **5/5 🟢** |
| `supabase` 2.30.0 (Storage 포함) | ✅ | 0 | 3주 전 | ✅ | ✅ | **5/5 🟢** |
| `beautifulsoup4` 4.14.3 | ✅ | 0 | 6개월 전 | ✅ + lxml | ✅ | **5/5 🟢** |
| `requests` 2.34.2 | ✅ | 0 | 2주 전 | ✅ | ✅ | **5/5 🟢** |
| `feedparser` 6.0.12 | ✅ | 0 | 8개월 전 | ✅ | ✅ | **5/5** — 단 **사용 제외** (Anthropic RSS 부재로 sitemap·HTML 폴링이 더 적합) |
| `smtplib` (Python stdlib) | ✅ | 0 | 표준 | ✅ 0 | ✅ | **5/5 🟢** |
| **사내 자산 — 선명AX `api/run.py`의 `self_critique`·tool round-trip 패턴** | ✅ | 0 | 즉시 적용 가능 | ✅ | ✅ | **5/5 🟢** (이식 — V3.1 검증된 코드) |

---

## 4-2. 부품 단위 분해

| 부품 | 책임 |
|---|---|
| Anthropic API 클라이언트 | 한글 번역 LLM 호출 (claude-sonnet-4-6) |
| Supabase Python 클라이언트 (Storage + posts INSERT) | WAAT 사이트 게시 + 이미지 업로드 |
| BeautifulSoup4 HTML 파서 | Anthropic /news /research 글 목록·본문 추출 |
| requests HTTP | sitemap.xml·HTML·이미지 다운로드 |
| smtplib + email.mime | PO 알림 메일 발송 |
| WAAT API 클라이언트 (자체 작성) | posts INSERT + Storage 업로드 wrapping |
| engine.py 본체 (자체 작성) | LLM 호출 + tool round-trip + self_critique |
| run.py 진입점 (자체 작성) | cron loop + 폴링·파이프라인 오케스트레이션 |
| history.json 관리 (자체 작성) | 처리한 글 URL 기록 (중복 방지) |
| 한국 독자 친화 번역 프롬프트 (자체 작성) | INSTRUCTION 핵심 — 한글·배경설명·용어풀이 |
| 마케팅 표현 필터 (자체 작성) | 금지 단어 후처리 검사 |
| 📌 한국 독자 메모 프롬프트 (자체 작성) | 본문 후처리에 짧은 한국 관점 추가 |
| sitemap·HTML 파싱 어댑터 (자체 작성) | Anthropic 사이트 특화 추출 로직 |

---

## 4-3. 안전성 진단 (주작 방식)

| 항목 | 검사 | 판정 |
|---|---|:-:|
| `eval()`·`exec()` 사용 후보 | 6개 OSS 라이브러리 모두 표준 사용 — eval 미포함 | ✅ 안전 |
| 하드코딩 시크릿·API 키 | `.env` 외부화 의무 (Anthropic·Supabase service_role·Gmail App Password 모두 env) | ✅ 안전 |
| PO 보안 가드 위반 | `G:\내 드라이브\` 무단 접근 없음 (WAAT 폴더만 접근) · `.env` git 미포함 (.gitignore) | ✅ 안전 |
| deprecated 라이브러리 | 6개 모두 최신 (6개월 이내) | ✅ 안전 |
| 한국어 출력 규칙 | INSTRUCTION에 명시 + 자가평가에서 영어 출력 시 재생성 | ✅ 안전 |
| `href` 없는 버튼·죽은 링크 | 에이전트는 UI 없음 (CLI). WAAT 사이트의 이미지 갤러리만 UI 영역 → speakup.js 검증 완료 | ✅ 안전 |
| 1년 이상 미유지보수 | 모든 후보 활발 | ✅ 안전 |

→ **결함 부품 없음.** `feedparser`만 "사용 제외"로 분류 (안전 문제 아님 — 단지 활용 시나리오 없음).

---

## 4-4. BOM 산출 — 5분류

### 🟢 정상 — 그대로 적용 (4건)

| # | 부품 | 출처 | 용도 |
|:-:|---|---|---|
| 1 | `anthropic==0.104.1` | PyPI 공식 | Claude API 호출 (한글 번역 + self_critique) |
| 2 | `supabase==2.30.0` | PyPI 공식 | WAAT posts INSERT + Storage 이미지 업로드 |
| 3 | `beautifulsoup4==4.14.3` + `lxml` | PyPI 공식 | Anthropic HTML 파싱 |
| 4 | `requests==2.34.2` | PyPI 공식 | HTTP·이미지 다운로드 |
| 5 | `smtplib` (Python 표준) | 표준 라이브러리 | 이메일 알림 발송 |

### 🟡 재단 후 적용 (1건)

| # | 부품 | 출처 | 재단 내용 |
|:-:|---|---|---|
| 1 | 선명AX `api/run.py`의 `self_critique` + tool round-trip 패턴 | 사내 자산 (선명AX V3.1) | API key 환경변수만 변경 (`SUNMYUNG` → `WAAT`) · WAAT 도메인에 맞게 메모리(`history.json`)·자가평가 임계값(≤2) 그대로 유지 · provider 단일화(Anthropic만, 4-provider 불필요) |

### 🔴 걸러냄 — 적용 거부 (1건)

| # | 부품 | 출처 | 사유 |
|:-:|---|---|---|
| 1 | `feedparser==6.0.12` | PyPI | Anthropic 사이트가 RSS 미제공. sitemap·HTML 파싱이 더 적합·정확 — 의존성 부담만 추가하므로 채택 거부 |

### 🏭 자체 제작 (8건)

| # | 부품 | 사유 |
|:-:|---|---|
| 1 | `engine.py` 본체 — LLM 호출·tool round-trip·self_critique 통합 | V3.1 패턴 이식 + WAAT 특화 |
| 2 | `run.py` 진입점 — cron loop + 폴링·파이프라인 오케스트레이션 | 단일 에이전트 진입점 자체 |
| 3 | WAAT API 클라이언트 (`waat_client.py`) — posts INSERT + Storage 업로드 | 발굴물 대체재 없음. supabase-py wrap |
| 4 | Anthropic 사이트 파싱 어댑터 (`anthropic_source.py`) — sitemap·HTML 특화 | 사이트 구조 변경 시 이곳만 수정 |
| 5 | `history.json` 관리 (`memory.py`) — URL·시각 기록·중복 검사 | 인프라 B 핵심 (DB 대체) |
| 6 | 한국 독자 친화 번역 프롬프트 (`skills/Claude새소식/SKILL.md` 안) | INSTRUCTION 핵심. 도메인 지식 |
| 7 | 마케팅 표현 필터 (`marketing_filter.py`) — 금지 단어 후처리 검사 | WAAT 특화 운용 헌법 |
| 8 | 📌 한국 독자 메모 생성 프롬프트 (`skills/Claude새소식/` 안에 별도 섹션) | 본문 후처리 도메인 지식 |

### 🔵 공통 인프라 (0건)

| 사유 |
|---|
| **단일 모드라 🔵 N/A.** 이중 분류 우선순위(🟢/🟡 > 🔵 > 🏭 > 🔴)에 따라 단일 모드에서는 🔵 불가 — 모든 자체 제작 부품은 🏭로 분류. |

---

## BOM 요약

| 분류 | 건수 | 비중 |
|:-:|:-:|:-:|
| 🟢 정상 | 5 | 36% |
| 🟡 재단 | 1 | 7% |
| 🔴 걸러냄 | 1 | 7% |
| 🏭 자체 제작 | 8 | 57% |
| 🔵 공통 인프라 | 0 | 0% |
| **합계** | **14** | **100%** |

(Phase 1 잠정 ~11개 → Phase 4 정밀 14개. feedparser 거부 + 일부 자체 제작 분해 더 세밀해짐.)

---

## 다음 단계 — Phase 5 설계 검증

- 규모: **L** (부품 14개 > 6개 기준)
- 의무: `/pro-persona-debate` + `/주작-sal-da`
- 검증 질문: "이 부품 조합이 KPI를 달성하는가? 가장 약한 부품은? 🟡 재단(self_critique 이식)의 위험은? Anthropic 사이트 구조 변경 대응 충분한가?"
