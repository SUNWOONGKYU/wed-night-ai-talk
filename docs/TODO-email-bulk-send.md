# 이메일 일괄 발송 기능 구현 계획

## 🎯 목표
관리자 페이지에서 멤버들을 선택하고, 제목과 내용을 작성해서 이메일을 한 번에 보내는 기능.

## 📌 왜 Resend를 사용하나?
- 웹사이트에서 직접 이메일을 보내려면 **이메일 발송 서비스**가 필요합니다
- Gmail로는 대량 발송이 불가능하고, 스팸으로 차단됩니다
- **Resend**(https://resend.com)는 개발자용 이메일 발송 서비스입니다
- **무료 플랜**: 월 3,000건, 하루 100건까지 무료 (우리 스터디 규모에 충분)

---

## 📋 구현 순서 (총 4단계)

### STEP 1. Resend 가입 및 API Key 발급

1. https://resend.com 접속
2. **Sign Up** 클릭 → GitHub 또는 이메일로 가입
3. 로그인 후 왼쪽 메뉴에서 **API Keys** 클릭
4. **Create API Key** 버튼 클릭
   - Name: `ai-study-circle` (아무 이름이나 OK)
   - Permission: **Full Access** 선택
5. 생성된 API Key 복사해서 안전한 곳에 저장 (예: `re_xxxxxxxxxxxx`)
   - ⚠️ 이 키는 한 번만 보여주므로 반드시 복사해둘 것!

6. **(선택) 발신 도메인 인증** — 커스텀 도메인이 있는 경우
   - 왼쪽 메뉴 **Domains** → **Add Domain**
   - 도메인 입력 후 안내에 따라 DNS 레코드 추가
   - 도메인이 없으면 Resend 기본 도메인(`onboarding@resend.dev`)으로 테스트 가능

---

### STEP 2. Supabase Edge Function 만들기

> Edge Function이란? Supabase 서버에서 실행되는 작은 프로그램입니다.
> API Key를 브라우저에 노출하지 않고 안전하게 이메일을 보낼 수 있습니다.

#### 2-1. Supabase CLI 설치 (컴퓨터에 한 번만)
```bash
npm install -g supabase
```

#### 2-2. 프로젝트 연결
```bash
cd "G:\내 드라이브\AI_Study_Circle"
supabase login
supabase link --project-ref vmiyqfkcoqdnkxjnxijt
```

#### 2-3. Edge Function 생성
```bash
supabase functions new send-email
```
이 명령을 실행하면 `supabase/functions/send-email/index.ts` 파일이 생깁니다.

#### 2-4. 코드 작성
`supabase/functions/send-email/index.ts` 파일을 열고 아래 내용으로 교체:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  // CORS 헤더 (브라우저에서 호출 가능하도록)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    })
  }

  try {
    // 1. 요청한 사용자가 관리자인지 확인
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("로그인 필요")

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    if (!profile || profile.role !== "admin") throw new Error("관리자 권한 필요")

    // 2. 요청 데이터 파싱
    const { to, subject, html } = await req.json()
    // to: 이메일 주소 배열 ["a@test.com", "b@test.com"]
    // subject: "모임 안내" (문자열)
    // html: "<h1>안녕하세요</h1><p>내용...</p>" (HTML 문자열)

    if (!to || !subject || !html) throw new Error("to, subject, html 필수")

    // 3. Resend API로 이메일 발송
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY가 설정되지 않았습니다")

    // 각 수신자에게 개별 발송 (BCC 대신 개별 발송으로 개인정보 보호)
    const results = []
    for (const email of to) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "AI Study Circle 110 <onboarding@resend.dev>",  // 도메인 인증 후 변경
          to: [email],
          subject: subject,
          html: html,
        }),
      })
      const data = await res.json()
      results.push({ email, success: res.ok, data })
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.length - successCount

    return new Response(
      JSON.stringify({ success: true, sent: successCount, failed: failCount, details: results }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    )
  }
})
```

#### 2-5. Resend API Key를 Supabase에 안전하게 저장
```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
```
(re_xxxxxxxxxxxx를 STEP 1에서 복사한 실제 API Key로 교체)

#### 2-6. Edge Function 배포
```bash
supabase functions deploy send-email --no-verify-jwt
```

#### 2-7. 배포 확인
배포 성공하면 아래 주소로 접근 가능:
```
https://vmiyqfkcoqdnkxjnxijt.supabase.co/functions/v1/send-email
```

---

### STEP 3. 관리자 페이지에 이메일 발송 UI 추가

#### 3-1. admin.html 변경사항
- 탭 버튼 추가: `<button class="admin-tab" data-tab="email">이메일 발송</button>`
- 이메일 발송 패널 추가:
  - 수신자 선택 (전체 선택 / 개별 체크박스)
  - 제목 입력란
  - 본문 입력란 (textarea)
  - 미리보기 버튼
  - 발송 버튼
  - 발송 결과 표시 영역

#### 3-2. admin.js 변경사항
- 멤버 목록 로드 시 체크박스 추가
- "전체 선택" 기능
- 발송 버튼 클릭 시:
  1. 선택된 멤버의 이메일 수집
  2. Edge Function 호출: `_supabase.functions.invoke('send-email', { body: { to, subject, html } })`
  3. 결과 표시 (성공 N건, 실패 N건)

---

### STEP 4. (선택) 발송 이력 저장

나중에 "언제 누구에게 무슨 이메일을 보냈는지" 기록하고 싶다면:

#### Supabase SQL Editor에서 테이블 생성:
```sql
CREATE TABLE email_logs (
    id SERIAL PRIMARY KEY,
    subject TEXT NOT NULL,
    body TEXT,
    recipients_count INTEGER DEFAULT 0,
    sent_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_logs"
    ON email_logs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
```

---

## 💰 비용 정리
| 항목 | 비용 |
|------|------|
| Resend 무료 플랜 | 월 3,000건, 일 100건 무료 |
| Supabase Edge Functions | 무료 플랜에 포함 (월 500,000건 호출) |
| **합계** | **무료** (스터디 규모에서는 충분) |

---

## ⏰ 구현 우선순위
1. ✅ STEP 1: Resend 가입 + API Key (먼저 해두면 좋음)
2. ✅ STEP 2: Edge Function (핵심 백엔드)
3. ✅ STEP 3: 관리자 UI (프론트엔드)
4. 🔲 STEP 4: 발송 이력 (나중에 필요하면)

---

## 🔗 참고 링크
- Resend 공식 문서: https://resend.com/docs
- Resend API 레퍼런스: https://resend.com/docs/api-reference/emails/send-email
- Supabase Edge Functions 가이드: https://supabase.com/docs/guides/functions
- Supabase Secrets 관리: https://supabase.com/docs/guides/functions/secrets
