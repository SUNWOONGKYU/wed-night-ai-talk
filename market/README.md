# WAAT 앱마켓 — 구조·문안 원칙 (정본)

PO 확정 2026-09-21. 마켓에 올라오는 모든 앱에 공통으로 적용한다. `market.html` 상단 주석은 이 파일을 가리킨다.

## 1. 앱 페이지 구조 원칙 — 앱에 딸린 페이지는 전부 그 앱 판매 페이지의 하위

앱 하나 = 판매 페이지 하나(`/market/<앱id>`). 설치 안내·설치 지시문·배포판 파일·사용법·FAQ·동봉물 안내 등 **앱에 딸린 것은 전부 그 아래**에 둔다. 사이트 최상위나 전역 nav 에 앱 부속 페이지를 두지 않는다.

정식 URL 은 항상 `/market/<앱id>/...`:

| 종류 | 정식 URL (원맥스 예) | 실제 파일 |
|---|---|---|
| 판매(상세) 페이지 | `/market/onemacs` | `market/onemacs.html` |
| PC 설치 안내 | `/market/onemacs/install` | `market/onemacs/install.html` |
| 설치 지시문(Claude Code 가 읽음) | `/market/onemacs/install.md` | `console/install.md` (rewrite) |
| 배포판 zip | `/market/onemacs/consolesystem_v2.zip` | `console/consolesystem_v2.zip` (rewrite) |
| 동봉물 설치 지시문·zip | `/market/onemacs/trading-bot.md` · `/market/onemacs/trading-bot_v1.zip` | `console/trading-bot.md` · `console/trading-bot_v1.zip` (rewrite) |
| 자주 묻는 질문 | `/market/onemacs/faq` | `market/onemacs/faq.html` |
| 알아 두실 점(보안·권한·잠금) | `/market/onemacs/notice` | `market/onemacs/notice.html` |
| CLI 호환 안내(앱이 읽음) | `/market/onemacs/compat.json` | `market/onemacs/compat.json` (JSON · CORS *) |

- 새 앱을 올릴 때도 같은 모양: `/market/<앱id>` + `/market/<앱id>/install` + `/market/<앱id>/<파일>`.
- 부속 페이지 진입은 **그 앱의 상세 페이지 버튼·구매/예약 완료 화면·메일 링크**에서만. 전역 nav·홈 카드에는 넣지 않는다.
- 부속 페이지 상단에는 경로 표시 `앱마켓 › <앱 이름> › <페이지 이름>` 를 두고, `canonical` 은 정식 URL 로 쓴다. sitemap 에도 정식 URL 만 올린다.
- 파일 자산(md·zip)은 저장소 위치를 옮기지 않고 `vercel.json` 의 `rewrites` 로 정식 경로에 연결한다(헤더 — text/plain·attachment — 도 정식 경로에 같이 선언).

## 2. 짧은 별칭 규칙 — 301 리다이렉트로만

사람이 손으로 치는 짧은 주소(예 `waat.community/console`)는 둘 수 있지만 **301 리다이렉트로만** 둔다. 별칭은 정식 URL 이 아니다:

- 사이트 메뉴·sitemap·canonical·메일·문서·상세 페이지의 링크는 항상 정식 하위 경로를 쓴다.
- 별칭은 이미 앱·문서·카탈로그에 박힌 주소가 깨지지 않게 하기 위한 것 — 지우지 않고 유지한다(원맥스: 앱 v1.4.x 문자열·설치 지시문·카탈로그에 `/console` 이 박혀 있음).
- 별칭 아래의 파일 경로(`/console/install.md` 등)는 그대로 200 으로 계속 서빙한다(앱과 Claude Code 가 그 주소를 읽는다). 정식 경로도 같은 파일로 200.

현재 리다이렉트/rewrite (`vercel.json`):

| 요청 | 결과 |
|---|---|
| `/console`, `/console.html` | 301 → `/market/onemacs/install` |
| `/console/install.md` · `/console/trading-bot.md` · `/console/*.zip` | 200 (그대로) |
| `/market/onemacs/install.md` · `/market/onemacs/trading-bot.md` · `/market/onemacs/*.zip` | 200 (같은 파일로 rewrite) |

## 3. 마켓 홈(`/market`) 원칙

- 홈에 두는 것: 헤더(검색·카테고리) · 앱 목록 하나(앱마다 배너형 카드, 로고 포함) · 푸터 한 줄 "내 앱을 이 마켓에 올리고 싶다면 → 문의".
- 홈에 **넣지 않는 것**: 특정 앱의 기능·고지·제작자·상표·면책, 마켓 안내, 결제 방법, 운영자 정보, 사업자 표기, 정책 링크, ©. (결제는 각 등록자의 일이고, WAAT 는 개인 운영 커뮤니티 사이트라 앱 판매자와 무관 — 판매자 표기는 그 앱의 상세 페이지에만.)
- 카드 데이터는 `js/market-apps.js`, 렌더는 `js/market-home.js`. 출시 전 앱은 `launch: 'config'` 로 두면 `/api/market-config` 의 `mode`(reserve|sale) 에 따라 "출시 예정 · 예약 받는 중" 배지 + "예약하기" 버튼으로 바뀐다.

## 4. 출시 모드 (원맥스)

`PRODUCT_MODE` 환경변수(Vercel): `reserve`(기본 — 출시 알림 예약만 받음) | `sale`(결제 UI). 상세·홈 프런트는 `/api/market-config` 의 `mode` 만 본다.
출시 첫날: `PRODUCT_MODE=sale` 로 바꾸고 `node scripts/notify-reservations.js`(PO 지시 때만; `--dry-run` 으로 먼저 확인).

## 5. 지원 창구 — FAQ · compat.json · "원맥스 진단해줘" · 알아 두실 점

지원 창구는 **세 가지뿐**(PO 2026-09-21): ① PC의 Claude Code 에 "원맥스 진단해줘" ② `/market/onemacs/faq` ③ 앱의 문제 신고 메일.
판매 페이지에는 지원 안내·지원 채널 문구를 넣지 않는다. 별도 채팅방 안내나 "N일 안에 답합니다" 같은 응답 기한 약속 문구는 어디에도 쓰지 않는다.

- `/market/onemacs/faq`: 자주 오는 문제 10개. 각 답 끝에 "그래도 안 되면 PC의 Claude Code 에 '원맥스 진단해줘'". 끝에 지원 창구 3가지. 진단 지시문(`원맥스_진단.md`)은 배포판에 동봉(배포판 담당).
- `/market/onemacs/notice` "알아 두실 점"(사람 말, 투자 면책 없음): PIN 이 유일한 잠금 / AI 사용료·약관·출력물은 각자의 계정 기준 / 전체 권한 모드(기본 안전 모드) / 로그인 5회 실패 1분·20회 1시간 잠금. 상세 하단·설치 페이지·FAQ 에서 링크.
- `install.md` 끝에 "문제가 생기면"(진단) + "알아 두실 점" 4줄.

### compat.json 갱신 절차
`market/onemacs/compat.json` 은 앱이 CLI(Claude Code·Codex·Antigravity·Grok) 버전 호환 안내를 읽는 정적 파일이다. 스키마:

```json
{"updated":"2026-09-21","notices":[{"ai":"codex","min_unsupported":"0.156.0","message":"Codex 0.156 이상은 아직 확인되지 않았습니다. 문제가 생기면 Claude Code 에게 맡기세요."}]}
```

- `ai`: `claude` | `codex` | `antigravity` | `grok`. `min_unsupported`: 이 버전 이상은 미확인. `message`: 앱에 그대로 보이는 사람 말(면책 문구 금지).
- 갱신은 **담당 세션이 파일을 수정해 커밋·push** 한다(Vercel 자동 배포, 캐시 5분). 확인된 뒤에는 항목을 지우고 `updated` 를 갱신. 지금은 `notices: []`.
- Content-Type `application/json` 과 CORS `*` 는 `vercel.json` headers 에 선언되어 있다.

## 6. 문안 규칙 요약 (PO 반복 지적)

- 브랜드 제목 2행: `One MACS · 원맥스` / `One-stop Multi AI Console System · 원스톱 멀티 AI 콘솔 시스템` (가운뎃점, 영어 먼저). 본문에서는 "원맥스".
- AI 4종(Claude Code·Codex·Antigravity·Grok)은 **협업** — "팀장/부하/부린다" 금지. 제목에 "API 요금" 넣지 않음.
- "창" → "대화창"/"실행 창", "폰으로" → "핸드폰에서", "쓰려면" → "사용하려면", 말풍선 → 채팅창.
- "PC 준비" 금지 → "PC에 원맥스 설치하기".
- 투자·매매 면책 문구 금지. 사람 말로, 축약하지 않는다.
- 결과·알림 텍스트는 순수 텍스트 위주(마크다운 지양).
