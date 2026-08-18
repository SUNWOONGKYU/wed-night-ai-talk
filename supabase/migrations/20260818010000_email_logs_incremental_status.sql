-- =============================================
-- email_logs 진행상태 추적 컬럼 추가 - 2026-08-18
-- =============================================
-- send-email Edge Function 이 발송 루프 도중 (Supabase 실행시간 제한 등으로) 강제
-- 종료되면, 기존에는 이력 저장 INSERT 가 루프 종료 후에야 실행돼서 아무 기록도
-- 안 남았다 (283명 발송 시 확인된 버그: Resend 에는 실제로 발송됐는데 email_logs
-- 는 비어 있었음). status/updated_at 을 추가해 Edge Function 이 루프 시작 전에
-- 'in_progress' 행을 먼저 쓰고 매 건마다 갱신하도록 바꾼다 - 중간에 죽어도
-- 어디까지 갔는지 이 테이블만 보고 알 수 있게.
-- =============================================

ALTER TABLE email_logs
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN email_logs.status IS
    '''in_progress'' (발송 루프 시작 시 기록) -> ''completed'' (루프 정상 종료). '
    '''in_progress'' 로 오래 멈춰 있으면 Edge Function 이 죽은 채로 남은 것.';
