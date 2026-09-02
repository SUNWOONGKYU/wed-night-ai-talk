-- 1회차 노을(slot=29)에서 [member-E] 제거 (20명 초과 정원 조정)

DO $$
DECLARE
    v_user_id UUID := 'dfb78bda-aa7e-4503-b156-3193f919c9b6';
    v_deleted INTEGER;
BEGIN
    DELETE FROM attendance
    WHERE user_id = v_user_id AND event_id = 3;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[member-E] 1회차 신청 % 건 삭제', v_deleted;
END $$;
