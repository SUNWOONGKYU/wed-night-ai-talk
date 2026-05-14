-- =============================================
-- 이메일 발송 이력 (email_logs) - 2026-05-14
-- =============================================
-- send-email Edge Function 이 발송 결과를 기록하는 테이블.
-- 관리자만 조회/삽입 가능 (RLS).
-- =============================================

CREATE TABLE IF NOT EXISTS email_logs (
    id BIGSERIAL PRIMARY KEY,
    subject TEXT NOT NULL,
    body_preview TEXT,                       -- 본문 앞 500자 미리보기 (DB 용량 절약)
    recipients_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    recipients JSONB,                        -- ["a@x.com", "b@x.com", ...]
    details JSONB,                           -- [{email, success, resend_id|error}, ...]
    sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sent_by_email TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_by ON email_logs(sent_by);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- 관리자만 조회 가능 (is_admin() 함수는 보안 마이그레이션에서 이미 정의됨)
DROP POLICY IF EXISTS "Admins can view email logs" ON email_logs;
CREATE POLICY "Admins can view email logs" ON email_logs
    FOR SELECT USING (is_admin());

-- Edge Function 이 SERVICE_ROLE 로 직접 INSERT 하므로 RLS INSERT 정책은 필요 없음
-- 그러나 ANON 클라이언트의 직접 INSERT 는 차단해야 함 → 정책 미생성 = 기본 차단

COMMENT ON TABLE email_logs IS '이메일 일괄 발송 이력. Edge Function send-email 이 SERVICE_ROLE 로 기록.';
