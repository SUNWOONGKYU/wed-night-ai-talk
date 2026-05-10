-- 2026-05-10 Phase 4: 슬롯별 신청 취소 RPC + 슬롯별 인원 집계 RPC

-- ========================================
-- 1. cancel_attendance: 슬롯 단위 신청 취소
--    p_slot_id NULL 이면 해당 이벤트의 모든 슬롯 신청 취소 (호환용)
-- ========================================
CREATE OR REPLACE FUNCTION cancel_attendance(
    p_event_id INTEGER,
    p_slot_id  TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF p_slot_id IS NULL THEN
        DELETE FROM attendance
        WHERE user_id = auth.uid() AND event_id = p_event_id;
    ELSE
        DELETE FROM attendance
        WHERE user_id = auth.uid()
          AND event_id = p_event_id
          AND slot_id  = p_slot_id;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_attendance(INTEGER, TEXT) TO authenticated;

-- ========================================
-- 2. get_slot_counts: 이벤트의 3슬롯별 회원/게스트 신청자 수
--    SECURITY DEFINER로 RLS 우회 — 누구나 인원수 조회 가능 (개인정보 아님)
-- ========================================
CREATE OR REPLACE FUNCTION get_slot_counts(p_event_id INTEGER)
RETURNS TABLE(slot_id TEXT, member_count BIGINT, guest_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        s.slot_id,
        COALESCE(a.cnt, 0) AS member_count,
        COALESCE(i.cnt, 0) AS guest_count
    FROM (VALUES ('sun'), ('dusk'), ('moon')) AS s(slot_id)
    LEFT JOIN (
        SELECT slot_id, COUNT(*)::BIGINT AS cnt
        FROM attendance
        WHERE event_id = p_event_id AND slot_id IS NOT NULL
        GROUP BY slot_id
    ) a USING (slot_id)
    LEFT JOIN (
        SELECT slot_id, COUNT(*)::BIGINT AS cnt
        FROM inquiries
        WHERE event_id = p_event_id AND slot_id IS NOT NULL
        GROUP BY slot_id
    ) i USING (slot_id);
$$;

GRANT EXECUTE ON FUNCTION get_slot_counts(INTEGER) TO anon, authenticated;
