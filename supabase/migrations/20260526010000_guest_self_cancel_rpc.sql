-- =============================================
-- 비회원(게스트) 본인 신청 셀프 취소용 RPC 2종 - 2026-05-26
-- =============================================
-- 본인 확인: 이름(trim) + 휴대폰 매칭. anon에서 호출 가능.
-- 1) find_guest_attendances : 본인의 미래 모임 신청 목록 조회
-- 2) cancel_guest_attendance_by_owner : 본인 확인 후 단건 삭제
-- =============================================

-- 1) 본인 신청 목록 검색
CREATE OR REPLACE FUNCTION find_guest_attendances(p_name TEXT, p_phone TEXT)
RETURNS TABLE (
    id BIGINT,
    event_id INTEGER,
    event_date DATE,
    event_title TEXT,
    slot_label TEXT,
    slot_emoji TEXT,
    slot_time TIME,
    slot_end_time TIME,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        ga.id,
        ga.event_id,
        e.event_date,
        e.title AS event_title,
        es.slot_label,
        es.slot_emoji,
        es.slot_time,
        es.slot_end_time,
        ga.created_at
    FROM guest_attendance ga
    JOIN events e ON e.id = ga.event_id
    JOIN event_slots es ON es.id = ga.event_slot_id
    WHERE trim(ga.name) = trim(p_name)
      AND ga.phone = p_phone
      AND e.event_date >= CURRENT_DATE
      AND e.is_active = true
    ORDER BY e.event_date ASC, es.sort_order ASC;
$$;

REVOKE ALL ON FUNCTION find_guest_attendances(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_guest_attendances(TEXT, TEXT) TO anon, authenticated;

-- 2) 본인 확인 후 삭제
CREATE OR REPLACE FUNCTION cancel_guest_attendance_by_owner(
    p_id BIGINT,
    p_name TEXT,
    p_phone TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    -- 본인 확인 (이름+휴대폰+id 3중 매칭)
    SELECT COUNT(*) INTO v_count
    FROM guest_attendance
    WHERE id = p_id
      AND trim(name) = trim(p_name)
      AND phone = p_phone;

    IF v_count = 0 THEN
        RETURN FALSE;
    END IF;

    DELETE FROM guest_attendance WHERE id = p_id;
    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION cancel_guest_attendance_by_owner(BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_guest_attendance_by_owner(BIGINT, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION find_guest_attendances IS '게스트 본인의 미래 모임 신청 목록 조회 (이름+휴대폰 매칭)';
COMMENT ON FUNCTION cancel_guest_attendance_by_owner IS '게스트 본인 신청 취소 (id+이름+휴대폰 3중 매칭으로 본인 확인)';
