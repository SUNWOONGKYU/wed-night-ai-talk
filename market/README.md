# WAAT AI 툴 마켓 — 구조·문안 원칙 (정본)

PO 확정 2026-09-21. 마켓에 올라오는 모든 툴에 공통으로 적용한다. `market.html` 상단 주석은 이 파일을 가리킨다.

## 1. 툴 페이지 구조 원칙 — 툴에 딸린 페이지는 전부 그 툴 판매 페이지의 하위

툴 하나 = 판매 페이지 하나(`/market/<앱id>`). 설치 안내·설치 지시문·배포판 파일·사용법·FAQ·동봉물 안내 등 **툴에 딸린 것은 전부 그 아래**에 둔다. 사이트 최상위나 전역 nav 에 툴 부속 페이지를 두지 않는다.

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
| 리뷰·댓글 | `/market/onemacs/reviews` | `market/onemacs/reviews.html` (툴 공통: `body[data-app]` 만 다름) |
| 사용법 매뉴얼 — **마켓 링크 없음**(허브·모바일 앱 ⓘ · 설치 완료 안내 · 배포판 동봉에서만 진입; 이미지 `market/img/guide/*.jpg` 는 .gitignore `*.jpg` 때문에 `git add -f`) | `/market/onemacs/guide` | `market/onemacs/guide.html` (+ 같은 본문의 오프라인 단일 파일 `C:	rader-bot\_dist\배포판_문서원본\사용법.html` — 배포판 zip 동봉, 콘솔 서버 /guide · 모바일 앱 "?" 버튼) |
| CLI 호환 안내(앱이 읽음) | `/market/onemacs/compat.json` | `market/onemacs/compat.json` (JSON · CORS *) |

- 새 툴을 올릴 때도 같은 모양: `/market/<앱id>` + `/market/<앱id>/install` + `/market/<앱id>/<파일>`.
- 부속 페이지 진입은 **그 툴의 상세 페이지 버튼·구매/예약 완료 화면·메일 링크**에서만. 전역 nav·홈 카드에는 넣지 않는다.
- 부속 페이지 상단에는 경로 표시 `AI 툴 마켓 › <툴 이름> › <페이지 이름>` 를 두고, `canonical` 은 정식 URL 로 쓴다. sitemap 에도 정식 URL 만 올린다.
- 파일 자산(md·zip)은 저장소 위치를 옮기지 않고 `vercel.json` 의 `rewrites` 로 정식 경로에 연결한다(헤더 — text/plain·attachment — 도 정식 경로에 같이 선언).

## 2. 짧은 별칭 규칙 — 301 리다이렉트로만

사람이 손으로 치는 짧은 주소(예 `waat.community/console`)는 둘 수 있지만 **301 리다이렉트로만** 둔다. 별칭은 정식 URL 이 아니다:

- 사이트 메뉴·sitemap·canonical·메일·문서·상세 페이지의 링크는 항상 정식 하위 경로를 쓴다.
- 별칭은 이미 모바일 앱·문서·카탈로그에 박힌 주소가 깨지지 않게 하기 위한 것 — 지우지 않고 유지한다(원맥스: 모바일 앱 v1.4.x 문자열·설치 지시문·카탈로그에 `/console` 이 박혀 있음).
- 별칭 아래의 파일 경로(`/console/install.md` 등)는 그대로 200 으로 계속 서빙한다(모바일 앱과 Claude Code 가 그 주소를 읽는다). 정식 경로도 같은 파일로 200.

현재 리다이렉트/rewrite (`vercel.json`):

| 요청 | 결과 |
|---|---|
| `/console`, `/console.html` | 301 → `/market/onemacs/install` |
| `/console/install.md` · `/console/trading-bot.md` · `/console/*.zip` | 200 (그대로) |
| `/market/onemacs/install.md` · `/market/onemacs/trading-bot.md` · `/market/onemacs/*.zip` | 200 (같은 파일로 rewrite) |

## 3. 마켓 홈(`/market`) 원칙

- 홈에 두는 것: 헤더(검색·카테고리) · 툴 목록 하나(툴마다 배너형 카드, 로고 포함) · 푸터 한 줄 "내 툴을 이 마켓에 올리고 싶다면 → 문의".
- 홈에 **넣지 않는 것**: 특정 툴의 기능·고지·제작자·상표·면책, 마켓 안내, 결제 방법, 운영자 정보, 사업자 표기, 정책 링크, ©. (결제는 각 등록자의 일이고, WAAT 는 개인 운영 커뮤니티 사이트라 툴 판매자와 무관 — 판매자 표기는 그 툴의 상세 페이지에만.)
- 카드 데이터는 `js/market-apps.js`, 렌더는 `js/market-home.js`. 출시 전 툴은 `launch: 'config'` 로 두면 `/api/market-config` 의 `mode`(reserve|sale) 에 따라 "출시 예정 · 예약 받는 중" 배지 + "예약하기" 버튼으로 바뀐다.

## 4. 출시 모드 (원맥스)

`PRODUCT_MODE` 환경변수(Vercel): `reserve`(기본 — 출시 알림 예약만 받음) | `sale`(결제 UI). 상세·홈 프런트는 `/api/market-config` 의 `mode` 만 본다.
출시 첫날: `PRODUCT_MODE=sale` 로 바꾸고 `node scripts/notify-reservations.js`(PO 지시 때만; `--dry-run` 으로 먼저 확인).

## 5. 지원 창구 — FAQ · compat.json · "원맥스 진단해줘" · 알아 두실 점

지원 창구는 **세 가지뿐**(PO 2026-09-21): ① PC의 Claude Code 에 "원맥스 진단해줘" ② `/market/onemacs/faq` ③ 모바일 앱의 문제 신고 메일.
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

## 6. 다크/라이트 모드 (2026-09-21)

- 색 토큰은 `css/theme.css` 한 곳: `:root` = 다크, `@media (prefers-color-scheme: light)` + `html[data-theme=light]` = 라이트. 다른 css(market·onemacs·console·market-home·site-nav)에는 하드코딩 색을 두지 않는다(브랜드 버튼 카카오·은행 색, 그라데이션 위 흰 글자만 예외).
- 마켓 페이지 head 순서: `theme.css` → `js/theme.js`(동기, 저장값 `localStorage.waat-theme` 를 첫 그리기 전에 `html[data-theme]` 에 적용 — CSP 가 인라인 스크립트를 막아 외부 파일) → 나머지 css. `theme.js` 가 헤더에 ☀/🌙 버튼을 넣는다.
- 새 페이지·새 색을 추가할 때: 토큰이 없으면 `theme.css` 다크·라이트 두 곳에 같이 추가한다. 라이트 대비 기준 본문 4.5:1 · 보조 3:1(Playwright 실측 스크립트: 세션 스크래치 rs_theme_test.py 방식 — 반투명 배경은 합성해서 계산).
- 다크 캡처 이미지(폰 목업·스크린샷)는 라이트에서도 그대로 두고 테두리·그림자로만 구분한다.
- **WAAT 로고는 변경 금지(라이트 모드 포함)** — PO 결정 2026-09-21. 라이트용 별도 로고를 만들지 않고, 색·배경·크기·형태 어떤 변경도 하지 않는다. 다크/라이트 모두 현행 `logo-waat.png` 그대로.

## 5-1. 카탈로그·상세(사기 전) ↔ 사용법(받은 후) 내용 구분 원칙 (PO 2026-09-21)

- **카탈로그·상세 페이지(사기 전)**: 무엇인지·왜 좋은지·가격·동봉물·판매자 — 마켓 꾸밈(헤더·nav·경로 줄·탭)을 쓴다.
- **사용법(받은 후, `/market/onemacs/guide` + 배포판 `사용법.html`)**: 조작법만. 소개·장점·카탈로그성 문구·구매 유도·동봉물 홍보를 넣지 않는다(동봉물은 사용 안내 링크만). 틀은 앱 문서 틀 — 가벼운 헤더 1줄(제목 + 화면 밝기 버튼)·목차·맨 위로 버튼·다크/라이트 토큰·responsive, WAAT 헤더·nav·경로 줄·탭 없음.
- 사용법 진입은 ① 허브·모바일 앱의 ⓘ ② 설치 완료 안내(설치 페이지 7단계 끝 · install.md 끝) ③ 배포판 동봉 파일에서만. 마켓 홈·상세·리뷰·FAQ·notice 에는 사용법 링크를 두지 않는다(상세·리뷰 탭은 "상세 보기 · 리뷰" 둘). sitemap 에는 남긴다.
- 웹·오프라인은 한 벌(빌드 스크립트 gd_build.py — 세션 스크래치; 본문 1벌로 두 파일 생성).

## 6-1. 모바일 최소폭 반응형 (2026-09-21, PO 지적)

- `css/responsive.css` 를 마켓 전 페이지에서 **마지막**에 로드한다(theme.css 최상단에도 `text-size-adjust:100%`). 카탈로그 원본 `모바일콘솔/3_안드로이드앱/카탈로그/index.html` 의 `<style>` 끝에도 같은 규칙.
- 브레이크포인트: ≤360 소형 폰 · ≤430 폰 · ≤768 태블릿/가로 · 그 위 데스크톱. 글자: h1 clamp(22px,6.5vw,30px) · 리드 clamp(15px,4.2vw,17px) · 본문 15px(≤360 14px) · 카드 제목 clamp(16px,4.5vw,18px) · 여백 16px(≤360 14px).
- 원칙: `body{overflow-x:hidden}` 으로 덮지 않고 원인을 없앤다 — `body{overflow-wrap:anywhere}`(긴 경로·URL), 이미지 max-width, 요약 줄 ≤360 2×2, 경로 표시 줄바꿈, 표 ≤399 1열, 비교표는 가로 스크롤 상자 안에서만, `.cmpbox::after` 여백 보정.
- 검증 방법: Playwright 320·360·375·390·412·430 × (기본·페북 인앱 FBAN/FBAV·카카오톡 인앱 KAKAOTALK UA) 에서 `scrollWidth == innerWidth` 와 h1/리드/본문 px 실측(세션 스크래치 rw_test.py 방식).

## 7. 리뷰·댓글 (툴 공통 · 2026-09-21)

- 페이지 `/market/<앱id>/reviews`(`market/<앱id>/reviews.html`, `body[data-app]`·`data-app-name`), `css/reviews.css`, `js/reviews.js`. 판매 페이지 상단 메뉴 "상세 보기 · 리뷰(N)"(`.tabs`, market.css).
- 저장: Supabase WAAT 프로젝트 `market_reviews` / `market_comments` / `market_verify_tokens` / `market_reports` / `market_rate_hits` + view `market_review_summary` (`supabase/migrations/20260921010000_market_reviews.sql`). RLS 켜고 정책 없음 → Vercel 함수가 `SUPABASE_SERVICE_KEY` 로만 접근(`api/lib/supabase.js`). 구글시트 사용 안 함.
- API: `api/reviews.js`(목록·요약·생성·확인·내 리뷰 고치기/지우기) · `api/review-comments.js`(댓글·답글 1단계) · `api/review-report.js`(신고 3건 자동 숨김 + 판매자 메일) · `api/review-admin.js`(`X-Admin-Key` = `REVIEW_ADMIN_KEY`: 숨김/복구/지우기/판매자 답글). 공통 `api/lib/reviews.js`(검증·마스킹·이메일 해시·레이트리밋 DB 정본·토큰).
- 규칙: 이메일 확인 링크(24시간 1회) 클릭 시 게시 · 이메일 원문 저장 안 함(`REVIEW_HASH_SALT` 해시) · 같은 이메일은 툴당 리뷰 1개 · 수정은 `pending_*` 에 두었다가 확인 시 교체(게시본 유지) · 삭제 = `deleted` + 댓글 숨김 · 판매자 답글 닉네임 "파인더월드" + 판매자 배지 · 링크/이메일/전화 마스킹 · 같은 IP 1분 3건 · honeypot · 관리 키는 sessionStorage 만.
- **가짜 리뷰 금지**: 시드·테스트 리뷰를 운영 툴(app_code `onemacs`)에 넣지 않는다. 테스트는 app_code `test` 로만 하고 끝나면 지운다. 캡처도 빈 상태·실제 데이터만.
- env: `SUPABASE_URL` · `SUPABASE_SERVICE_KEY` · `REVIEW_HASH_SALT` · `REVIEW_ADMIN_KEY` · `SELLER_NOTIFY_EMAIL`(없으면 SUPPORT_EMAIL). 개인정보처리방침(privacy.html 1절)에 리뷰 항목 명시.

## 8. 툴 정보 블록 (툴 공통 · 2026-09-21)

- 상단 요약 줄(카드·상세 공통): ★평점(리뷰 N) · 다운로드 N회(예약 모드는 예약 N명) · 연령 · 용량. 상세 "툴 정보" 표 15항목(접기 없이, 390px 미만 1열). 렌더 `js/market-appinfo.js`, 스타일 `css/market-appinfo.css`.
- **실제 값만**: `js/market-apps.js` 항목 필드(age·android·delivery·needs·permissions·dataSafety·changelog·lang·iap·released·seller·reportEmail)에 없는 값은 항목이 자동으로 숨는다(호환/태블릿은 실기기 확인 전이라 필드 없음). 추정·꾸밈 금지.
- 단일 소스: 버전·업데이트 날짜 = `/api/market-config`(`PRODUCT_VERSION`·`PRODUCT_UPDATED` — APK 교체 시 둘 다 갱신) · 다운로드 수·다운로드 크기 = `/api/market-stats`(Orders+DownloadLogs 합산, APK HEAD, 1시간 캐시) · 예약 수 = `/api/reserve-count` · 평점 = `/api/reviews?summary=1`.
- 판매자 행은 상호 + "판매자 정보 보기"(→ 상세 하단 `#seller` 블록) 링크만. 전자상거래 표시 항목(파인더월드 · 대표 선웅규 · 사업자등록번호 354-33-01641 · 서울특별시 강남구 테헤란로63길 9, 916호(삼성동) · 통신판매업 신고: 준비 중 · 문의 wksun999@hanmail.net · 상표출원 40-2026-0198709)은 그 블록 한 곳에만 쓴다. "통신판매업 신고: 준비 중" 고정 문구(번호 자리·사유·예정일 금지).
- 변경 내역(changelog)은 사용자 관점 문장, 버전별 3줄 이내, 최신 3개 + "이전 버전 보기". 근거 없는 버전은 비워 둔다.

## 9. 문안 규칙 요약 (PO 반복 지적)

- 브랜드 제목 2행: `One MACS · 원맥스` / `One-stop Multi AI Console System · 원스톱 멀티 AI 콘솔 시스템` (가운뎃점, 영어 먼저). 본문에서는 "원맥스".
- AI 4종(Claude Code·Codex·Antigravity·Grok)은 **협업** — "팀장/부하/부린다" 금지. 제목에 "API 요금" 넣지 않음.
- "창" → "대화창"/"실행 창", "폰으로" → "핸드폰에서", "쓰려면" → "사용하려면", 말풍선 → 채팅창.
- "PC 준비" 금지 → "PC에 원맥스 설치하기".
- 투자·매매 면책 문구 금지. 사람 말로, 축약하지 않는다.
- 결과·알림 텍스트는 순수 텍스트 위주(마크다운 지양).

## 10. 근거 — "핸드폰에서 조작할 수 없던 AI 3종" 블록 (확인일 2026-09-21)

상세·카탈로그 장점 1번 블록의 사실 확인 기록. 다시 확인할 때는 아래 URL 을 열어 확인일을 갱신한다.

| AI | 핸드폰에서 PC 세션 조작(공식) | 근거 |
|---|---|---|
| Claude Code | **있음** — Remote Control: "Continue a local Claude Code session from your phone, tablet, or any browser… Works with claude.ai/code and the Claude mobile app." | https://code.claude.com/docs/en/remote-control |
| Codex | **CLI 에는 없음** — ChatGPT 데스크톱 앱(macOS·Windows)을 거치는 Remote 만 있음: "Mobile setup starts from the app; you can't set it up from the Codex CLI or IDE extension." | https://learn.chatgpt.com/docs/remote-connections (developers.openai.com/codex/remote-connections 에서 이동) |
| Antigravity(Gemini CLI) | **없음** — 공식 문서에 원격/모바일 조작 기능 없음. 요청 이슈 "Remote control access to terminal based sessions via mobile app"(2026-05-19 개설)는 "Closed as not planned" | https://geminicli.com/docs/ · https://github.com/google-gemini/gemini-cli/issues/27289 |
| Grok CLI(Grok Build) | **없음** — 공식 시작 문서에 원격/모바일 조작 언급 없음 | https://docs.x.ai/build/overview |

문안 규칙: "만들게 된 큰 계기 중 하나"까지만(단정 금지). Codex 는 CLI 자체에 없다는 점을 괄호로 명시. 확인이 안 되는 항목은 "공식 원격 조작 기능이 확인되지 않습니다"로 낮춘다.
