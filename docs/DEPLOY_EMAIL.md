# 📧 이메일 발송 시스템 배포 가이드

작성일: 2026-05-14
대상: WAAT 운영자

## 📦 작업 산출물

| 종류 | 파일 |
|---|---|
| DB 마이그레이션 | `supabase/migrations/20260514070000_email_logs.sql` |
| Edge Function | `supabase/functions/send-email/index.ts` |
| 클라이언트 래퍼 | `js/supabase-config.js` (DB.sendBulkEmail / DB.getEmailLogs) |
| 관리자 UI | `admin.html` (📧 이메일 발송 탭) |
| 핸들러 | `js/admin.js` (initEmailPanel 등) |
| 환경변수 | `.env` (커밋 제외) + `.env.example` (템플릿) |

---

## 🚀 배포 순서 (4단계)

### STEP 1. DB 마이그레이션 실행

**방법 A (권장): Supabase Dashboard**
1. https://supabase.com/dashboard/project/vmiyqfkcoqdnkxjnxijt/sql 접속
2. **+ New query** 클릭
3. 파일 `supabase/migrations/20260514070000_email_logs.sql` 전체 내용 복사 후 붙여넣기
4. **Run** 클릭 → `Success. No rows returned` 확인

**방법 B: Supabase CLI**
```bash
cd "G:/내 드라이브/백업_AI스터디모임"
supabase db push
```

---

### STEP 2. Supabase CLI 설치 + 로그인 (최초 1회)

```bash
# Windows (Scoop 사용)
scoop install supabase

# 또는 npm
npm install -g supabase

# 로그인 (브라우저 열림)
supabase login

# 프로젝트 연결 (저장소 루트에서)
cd "G:/내 드라이브/백업_AI스터디모임"
supabase link --project-ref vmiyqfkcoqdnkxjnxijt
```

---

### STEP 3. Secret 등록 (Resend API Key)

⚠️ 이 API Key는 본인만 알아야 합니다. 메모장에 보관된 키를 사용하세요.

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
supabase secrets set RESEND_FROM_EMAIL=onboarding@resend.dev
supabase secrets set RESEND_FROM_NAME="WAAT 운영자 선웅규"
supabase secrets set RESEND_REPLY_TO=wksun999@gmail.com
```

또는 Supabase Dashboard:
1. https://supabase.com/dashboard/project/vmiyqfkcoqdnkxjnxijt/settings/functions
2. **Edge Functions Secrets** 섹션에서 위 4개 항목 추가

---

### STEP 4. Edge Function 배포

```bash
cd "G:/내 드라이브/백업_AI스터디모임"
supabase functions deploy send-email
```

성공 시 표시되는 URL:
```
https://vmiyqfkcoqdnkxjnxijt.supabase.co/functions/v1/send-email
```

---

## ✅ 동작 확인 (테스트)

1. 사이트 (https://wed-night-ai-talk.vercel.app) 로그인 (관리자 계정)
2. https://wed-night-ai-talk.vercel.app/admin.html 접속
3. 상단 탭에서 **📧 이메일 발송** 클릭
4. 제목/본문 입력 → **🧪 나에게 테스트** 클릭
5. 본인 Gmail 받은편지함 확인 (스팸함도 확인)
6. 성공하면 **📨 전체 발송** 사용 가능

---

## 🔧 사용법

### 수신자 3가지 모드

| 모드 | 설명 |
|---|---|
| **전체 회원** | profiles 테이블의 모든 이메일 (중복 자동 제거) |
| **특정 모임 참석자** | 회차 선택 → attendance + guest_attendance 에서 이메일 추출 |
| **직접 입력** | 쉼표 또는 줄바꿈으로 구분된 이메일 직접 붙여넣기 |

### 본문 작성

- 일반 텍스트로 쓰면 줄바꿈이 `<br>` 로 자동 변환됨
- HTML 태그(`<p>`, `<a href="...">`, `<strong>` 등)를 직접 쓰면 그대로 적용됨

### 발송 흐름

```
[작성] → [수신자 미리보기 확인] → [미리보기 버튼으로 시각 확인]
       → [🧪 나에게 테스트] → 메일 확인 → [📨 전체 발송] → 확인 모달 → 발송
```

---

## 💰 비용

| 항목 | 한도 | 비용 |
|---|---|---|
| Resend 무료 플랜 | 일 100건, 월 3,000건 | 무료 |
| Supabase Edge Functions | 월 500,000 호출 | 무료 |
| **현재 상태** | 회원 27명 × 모임 4회 = 약 100건/월 | **무료 유지** |

---

## 🛡️ 보안 체크리스트

- [x] `.env` 가 `.gitignore` 에 포함됨
- [x] Edge Function 에서 `ADMIN_EMAILS` 화이트리스트 검증
- [x] 1회 최대 200명 제한 (스팸/오발송 방지)
- [x] 600ms 발송 간격 (Resend rate-limit 회피)
- [x] email_logs RLS — 관리자만 조회 가능
- [x] CORS 명시적으로 설정

---

## 🔄 향후 확장 아이디어

- 발송 실패 항목 재발송 버튼
- 이메일 템플릿 저장/불러오기
- 첨부파일 (Resend Attachments API)
- 수신자별 변수 치환 (`{이름}` → 실제 이름)
- 발송 예약 (Supabase Scheduled Functions)
- 클릭/오픈 추적 (Resend webhook)

---

## ❓ 문제 해결

### "RESEND_API_KEY secret 이 설정되지 않았습니다"
→ STEP 3 진행 후 Edge Function 재배포 (`supabase functions deploy send-email`)

### "관리자만 사용 가능합니다"
→ `js/supabase-config.js` 의 `ADMIN_EMAILS` 와 `supabase/functions/send-email/index.ts` 의 `ADMIN_EMAILS` 동기화 확인

### Resend 응답 422 "domain not verified"
→ FROM 주소가 `onboarding@resend.dev` 가 아닌 경우 발생. Resend Dashboard 에서 도메인 인증 후 RESEND_FROM_EMAIL secret 갱신

### 이메일이 스팸함으로 감
→ 본인 도메인 인증 + SPF/DKIM/DMARC 설정 권장 (Resend Dashboard → Domains)
