# WAAT — Wednesday Afternoon AI Talk

> 수요일 오후 AI 수다. AI를 주제로 자유롭게 이야기하는 오프라인 모임 + 자유발언 게시판.

🌐 운영 사이트: https://wed-night-ai-talk.vercel.app (또는 `WAAT_사이트_URL.txt` 참조)

## 기술 스택

| 분야 | 도구 |
|------|------|
| Frontend | Vanilla HTML/CSS/JS (Vite/React 미사용 — 단순 정적 사이트) |
| Backend | Supabase (Postgres + Auth + Edge Functions) |
| Email | Resend (Edge Function `send-email` 경유) |
| Hosting | Vercel (정적 배포) |
| Auth | Supabase Auth (이메일/비밀번호 + Google OAuth) |
| Animations | GSAP + ScrollTrigger (CDN) |

## 프로젝트 구조

```
WAAT/
├── index.html                — 메인 (모임 일정/장소/Free Talk 미리보기)
├── speakup.html              — 자유발언 게시판
├── profile.html              — 내 프로필/신청 현황
├── admin.html                — 관리자 (멤버/모임/장소/문의/이메일 발송)
├── privacy.html / terms.html — 약관 페이지
├── css/style.css             — 전체 스타일
├── js/
│   ├── supabase-config.js    — Supabase 클라이언트 + Auth/DB 래퍼
│   ├── main.js               — 메인 페이지 로직
│   ├── speakup.js            — 자유발언 로직
│   ├── profile.js            — 프로필 로직
│   ├── admin.js              — 관리자 패널
│   └── animations.js         — GSAP/Canvas 애니메이션
├── supabase/
│   ├── migrations/           — SQL 마이그레이션 (분류는 migrations/README.md 참조)
│   ├── functions/send-email/ — 이메일 발송 Edge Function
│   └── schema.sql            — 초기 스키마 스냅샷
├── vercel.json               — 배포 설정 + 보안 헤더 (CSP 포함)
├── docs/                     — 운영/보안 가이드
└── scripts/                  — Playwright 스크린샷/검증 스크립트
```

## 로컬 셋업

### 사전 요구
- Node.js 18+ (Playwright 스크립트 실행 시)
- Supabase CLI (마이그레이션 적용 시): `npm i -g supabase`

### 1) 환경변수
프로젝트 루트에 `.env` 생성 (Git에 커밋 금지):
```
RESEND_API_KEY=re_xxxxxxxxxx
```

Supabase 키는 `js/supabase-config.js`의 클라이언트용 anon key를 사용.
서버 측 secret(`RESEND_API_KEY` 등)은 Supabase secrets로 관리:
```bash
supabase secrets set RESEND_API_KEY=re_xxxx
```

### 2) 로컬 미리보기
정적 파일 서버 어떤 것이든:
```bash
npx serve .
# 또는
python -m http.server 8000
```

브라우저: http://localhost:3000 (포트는 도구에 따라 다름)

### 3) DB 마이그레이션 적용 (새 환경)
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## 배포

### Vercel
- main 브랜치 → 자동 배포
- 보안 헤더(CSP/HSTS/X-Frame-Options 등)는 `vercel.json`에 정의

### Edge Function 배포
```bash
supabase functions deploy send-email
```

자세한 절차: `docs/DEPLOY_EMAIL.md`

## 보안 정책

1. **API Key 관리**: Resend/Supabase service-role 키는 Supabase Secrets로만 보관. 정기 회전 권장 → `docs/URGENT_RESEND_KEY_ROTATION.md`
2. **PII**: 마이그레이션 SQL에 실명/휴대폰 평문 금지. 작성 시 user_id로 처리. → `docs/GIT_HISTORY_PII_CLEANUP.md`
3. **CSP**: vercel.json에서 default-src 'self' 기반 화이트리스트 정책
4. **CORS (Edge Function)**: Origin 화이트리스트 — 운영 도메인 + localhost만 허용
5. **비밀번호**: 8자 이상, 공백 제외, 영문/숫자/특수문자 허용
6. **XSS**: 모든 사용자 입력은 `escapeHtml` / `escapeAttr` 통과 후 innerHTML 사용

## 운영 가이드

- 관리자 페이지: `admin.html` — 멤버/모임/장소/문의 관리, 이메일 일괄 발송
- 관리자 이메일 화이트리스트: `js/admin.js`의 `ADMIN_EMAILS` + Edge Function 동기화
- 일정 업데이트: 관리자 → 모임 추가/수정 (DB는 `events` + `event_slots` 테이블)

자세한 사용법: `GUIDE_FOR_ADMIN.md`

## 문서

| 파일 | 내용 |
|------|------|
| `docs/DEPLOY_EMAIL.md` | 이메일 시스템 배포 절차 |
| `docs/TODO-email-bulk-send.md` | 이메일 발송 기능 TODO |
| `docs/URGENT_RESEND_KEY_ROTATION.md` | Resend API 키 회전 절차 |
| `docs/GIT_HISTORY_PII_CLEANUP.md` | git history PII 정제 (필요 시) |
| `supabase/migrations/README.md` | 마이그레이션 분류 가이드 |
| `GUIDE_FOR_ADMIN.md` | 관리자용 사용 가이드 |

## 라이선스 / 운영

- 운영자: Sunny (선웅규)
- Facebook: https://www.facebook.com/share/1RDFNuTt9t/
- Since 2026-05-09
