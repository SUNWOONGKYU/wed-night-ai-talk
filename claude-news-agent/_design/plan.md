---
title: "Claude 새소식 한글 자동발행 에이전트 — 기획안"
agent_name: "claude-news-agent"
agent_target: "WAAT 커뮤니티 /speakup"
created: 2026-05-27
phase: 1
mode: 단일
infra: B
status: draft
---

# 📐 기획안 — claude-news-agent

> Claude(Anthropic) 새 소식을 자동 수집·한글 번역·WAAT 자동 게시하는 에이전트.

---

## 1. 목적 · Pain Point

- **현재 상태**: 한국 AI 커뮤니티에서 Claude 한글 큐레이션 채널 부족. WAAT 사이트도 PO가 수동으로 게시해야 채워짐.
- **에이전트 도입 후**: Anthropic 공식 새 글 → 자동 감지·한글 번역·WAAT 자동 게시 + PO 사후 검토 알림.
- **핵심 가치**: PO의 매번 수동 게시 부담 제거 + WAAT 커뮤니티에 한글 Claude 정보 정기 공급.

## 2. 트리거

**15분 간격 폴링** (사실상 실시간):
- Anthropic 뉴스룸 (`anthropic.com/news`) + Engineering Blog (`anthropic.com/research`) HTML/RSS 폴링
- 신규 글 감지 시 즉시 파이프라인 발동
- PC 상시 켜둠 (Windows) — PC 꺼진 시간은 켜질 때 따라잡음

## 3. 입력 / 출력

| 입력 | 출처 |
|---|---|
| 영문 Claude 새 글 (제목·본문·이미지·발행시각·URL) | Anthropic 공식 (뉴스룸 + Engineering Blog) |

| 출력 | 형태 |
|---|---|
| 한글 번역 글 + 이미지 + 출처 링크 | WAAT `/speakup` "AI 새소식" 카테고리 자동 게시 |
| 게시 알림 (제목·WAAT URL) | 이메일 (wksun999@gmail.com) |
| 자가평가 실패·오류 알림 + 초안 | 이메일 |

## 4. 제약 조건

- **한글 출력 필수** — 영문 직역도 안 됨, 한국 독자 친화 풀이까지
- **마케팅 표현 금지** — `혁신적·획기적·놀라운·게임 체인저·~의 미래·전례 없는` 등 금지 리스트
- **추측 금지** — Anthropic이 직접 말한 것만 단정. 추측은 "원문에서 ~로 추정됨" 명시
- **출처 명시** — 모든 글에 Anthropic 원문 링크 포함
- **CLAUDE.md 헌법 준수** — 한국어 출력·보안 가드·`.env` 노출 금지
- **WAAT 사이트 영향 최소** — 글 카테고리·태그·제목 길이 등 사이트 규칙 준수

## 5. 실패 모드 · 처리

| 케이스 | 처리 |
|---|---|
| 중복 글 (이미 처리한 URL) | `history.json` 비교 → skip (조용히) |
| 폴링 실패 (Anthropic 사이트 응답 없음) | 5분 후 재시도 × 3회 → 실패 시 이메일 알림 |
| 번역 자가평가 ≤ 2점 | 재생성 1회 → 그래도 낮으면 자동 게시 보류 + 초안을 이메일 첨부 (PO 검토 후 수동 게시) |
| WAAT 게시 API 실패 | 1회 재시도 → 실패 시 초안 + 오류 메시지 이메일 |
| 이미지 다운로드 실패 | 본문에 "원본 이미지: [URL]" 링크만 (폴백) + 이메일 알림 |
| 새 글 없는 폴링 | 조용히 다음 주기 (알림 없음) |

## 6. 사용자

- **PO 본인** (선웅규 / wksun999@gmail.com) — admin 권한 보유, 사후 검토 + 필요시 수정·삭제
- **WAAT 커뮤니티 회원** (한국 AI 관심자) — 글 소비자

## 7. 차별점

- **한국어 Claude 큐레이션 채널 부족** — 빈 공간 채우기
- **단순 RSS 리더 아님** — 배경 설명·용어 풀이 + 한국 독자 시각 메모(`📌`) 포함
- **실시간 자동 발행 + 사후 검토** — 즉시성과 안전성 균형
- **WAAT 커뮤니티 특화** — 사이트 양식·카테고리·태그 자동 맞춤

## 8. 아키텍처 방향

**9단계 파이프라인** — 자세한 도식은 `_design/architecture.svg` 참고:

```
[PC 상시 켜둠 + cron 15분]
  ① Anthropic 뉴스룸·Research 폴링·파싱
  ② history.json 비교 → 신규만 통과
  ③ 본문·이미지 추출
  ④ LLM 한글 번역 (한국 독자 친화 + 마케팅 필터)
  ⑤ self_critique 자가평가 — 점수 ≤2면 재생성·보류
  ⑥ 양식 조립 — 날짜 prefix + TL;DR + 핵심 + 본문 + 이미지 + 원문링크 + 태그 + 📌한국독자 메모
  ⑦ WAAT API 게시 (이미지 업로드 포함)
  ⑧ history.json에 처리 기록
  ⑨ 이메일 알림 발송
```

**인프라**: B (DB 없음 — `.py` + API 키 + JSON 파일)
**구조**: 분리형 — `engine.py` + `skills/Claude새소식/SKILL.md` + `run.py` + `history.json`

## 9. 필요 부품 (잠정 — Phase 4에서 BOM 5분류 확정)

| 분류 잠정 | 부품 | 출처 |
|:-:|---|---|
| 🟢 정상 | `anthropic` Python SDK | PyPI 공식 (번역 LLM 호출용) |
| 🟢 정상 | `feedparser` | PyPI (RSS 파싱) |
| 🟢 정상 | `beautifulsoup4` | PyPI (HTML 파싱) |
| 🟢 정상 | `requests` | PyPI (HTTP·다운로드) |
| 🟢 정상 | Python `smtplib` | 표준 라이브러리 (이메일 발송) |
| 🏭 자체 제작 | WAAT API 클라이언트 (글 작성·이미지 업로드) | 사이트 API 분석 후 작성 |
| 🏭 자체 제작 | `engine.py` 본체 (LLM·self_critique·도구 round-trip) | V3.1 패턴 이식 |
| 🏭 자체 제작 | `history.json` 관리 | 중복 방지·기록 |
| 🏭 자체 제작 | 한국 독자 친화 번역 프롬프트 | INSTRUCTION 핵심 |
| 🏭 자체 제작 | 마케팅 표현 필터 (금지 단어 검사) | 자가평가 단계 |
| 🏭 자체 제작 | `📌 한국 독자 메모` 생성 프롬프트 | 본문 후처리 |
| ❓ 별도 트랙 | **WAAT 사이트 이미지 업로드 기능 구현** (현재 사이트에 없을 수 있음) | PO가 사이트 코드 수정 |

## 10. 잠정 구동 방식

**무인 자율형 — 스케줄·트리거형** (15분 cron 폴링 = 사실상 이벤트 기반)
- 인프라 B + 단일 모드
- PC 상시 켜둠 — Windows 작업 스케줄러 또는 nssm·pythonw 백그라운드 실행
- 인터넷 끊김·PC 재부팅 시 재시작 자동 (Windows 서비스 등록 또는 시작프로그램)

---

## 검증 시점에 확인할 것 (Phase 6 조립 전)

- [ ] WAAT `/speakup` API 엔드포인트 존재 여부 (post 작성·이미지 업로드)
- [ ] WAAT admin 인증 방식 (세션 쿠키 / API 토큰 / 다른 방식)
- [ ] Anthropic 뉴스룸의 RSS 제공 여부 (없으면 HTML 폴링)
- [ ] Anthropic Research 글 분리 — research 별도 URL인지 같은 뉴스룸인지

다음 단계: Phase 2 MBO 목표서 → PO 승인.
