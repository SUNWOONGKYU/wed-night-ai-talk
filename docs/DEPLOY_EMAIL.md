# 📧 이메일 발송 시스템 배포 가이드

작성일: 2026-05-14
대상: WAAT 운영자

## 📦 작업 산출물

| 종류 | 파일 |
|---|---|
| DB 마이그레이션 | `supabase/migrations/20260514070000_email_logs.sql` (테이블 생성), `20260818010000_email_logs_incremental_status.sql` (`status`/`updated_at` 컬럼 추가) |
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
cd "G:/내 드라이브/WAAT"
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
cd "G:/내 드라이브/WAAT"
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
cd "G:/내 드라이브/WAAT"
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
| Resend 유료 플랜 (2026-08-18~) | 무료 플랜의 일 100건/월 3,000건 한도 해제 | 유료 |
| Supabase Edge Functions | 월 500,000 호출 | 무료 |
| **현재 상태** | 회원 283명 × 일일 발굴 콘텐츠 발송 | **유료 플랜 사용 중** |

---

## 🛡️ 보안 체크리스트

- [x] `.env` 가 `.gitignore` 에 포함됨
- [x] Edge Function 에서 `ADMIN_EMAILS` 화이트리스트 검증
- [x] 1회 최대 2,000명 제한 (2026-08-18, 200명 → 상향. 스팸/오발송 방지용 안전장치일 뿐 Resend API 자체 제한 아님 — 발송은 건별 순차 호출, 배치 API 미사용)
- [x] 300ms 발송 간격 (2026-08-18, 600ms → 단축. Resend 유료 플랜 전환에 맞춰 절반으로 줄임 — 실제 초당 한도 확인 전이라 429 뜨면 다시 늘릴 것)
- [x] email_logs RLS — 관리자만 조회 가능
- [x] email_logs 는 발송 루프 시작 전에 `in_progress` 행을 먼저 쓰고 매 건 발송 직후 갱신 (2026-08-18 — 아래 "문제 해결" 참고)
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

### 📨 전체 발송을 눌렀는데 발송 이력(admin.html 하단 표)에 아무것도 안 남음

**2026-08-18 실사고**: 283명에게 전체 발송 → Resend Dashboard(resend.com/emails)에는 "Delivered"로 실제 발송이 확인되는데, `email_logs` 테이블엔 몇 분이 지나도 새 행이 안 생김.

**원인**: 수신자 수가 많으면(283명 × 발송 간격) 전체 루프 실행시간이 Supabase Edge Function 자체의 실행시간 제한에 근접/초과한다. 예전 코드는 발송 루프가 **끝난 뒤에야** `email_logs.insert()`를 한 번 실행했는데, 루프 도중 함수가 플랫폼에 의해 강제 종료되면 그 INSERT 자체가 실행되지 않아 — Resend로는 이미 다 나갔는데 WAAT 자체 기록은 하나도 안 남는다.

**고침 (`send-email/index.ts`)**: 발송 루프 **시작 전에** `status: 'in_progress'` 행을 먼저 INSERT 하고, 매 건 발송 직후 그 행을 UPDATE (성공/실패 카운트, 상세 내역). 루프가 끝나면 `status: 'completed'`로 마무리 UPDATE. 함수가 중간에 죽어도 어디까지 갔는지 `email_logs`만 보면 안다 — `status = 'in_progress'` 인 채로 오래 멈춰 있는 행이 있으면 그 발송은 죽은 것.

**의심되면**: admin.html 발송 이력 표가 아니라 **resend.com/emails 를 직접 확인**하는 게 최종 진실이다 (WAAT 자체 기록보다 우선).
