-- =============================================
-- 게스트 신청 RPC 폐기 (서버 차단) - 2026-06-04
-- =============================================
-- PO 결정: 게스트 신청 기능 제거, 회원만 신청 가능
-- 기존 guest_attendance 데이터는 보존 (셀프 취소·관리자 명단 위해)
-- find_guest_attendances / cancel_guest_attendance_by_owner RPC는 유지
-- =============================================

REVOKE EXECUTE ON FUNCTION public.create_guest_attendance(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM anon, authenticated;
DROP FUNCTION IF EXISTS public.create_guest_attendance(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER);

-- guest_attendance INSERT 정책도 차단 (defense-in-depth)
DROP POLICY IF EXISTS guest_attendance_insert_anyone ON guest_attendance;
-- INSERT 정책을 별도로 만들지 않음 → RLS 활성 + 정책 없음 = INSERT 거부

DO $$
DECLARE
    v_func_count INT;
    v_policy_count INT;
BEGIN
    SELECT count(*) INTO v_func_count
      FROM pg_proc WHERE proname = 'create_guest_attendance';
    SELECT count(*) INTO v_policy_count
      FROM pg_policies
     WHERE tablename = 'guest_attendance' AND cmd = 'INSERT';

    RAISE NOTICE '[ok] create_guest_attendance RPC: %건 남음 (목표 0)', v_func_count;
    RAISE NOTICE '[ok] guest_attendance INSERT 정책: %건 (목표 0)', v_policy_count;
END $$;
