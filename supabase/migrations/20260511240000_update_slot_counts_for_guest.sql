-- get_slot_counts RPC를 guest_attendance 테이블 기준으로 갱신
DROP FUNCTION IF EXISTS get_slot_counts(INTEGER);

CREATE OR REPLACE FUNCTION get_slot_counts(p_event_id INTEGER)
RETURNS TABLE(
    event_slot_id INTEGER,
    slot_label TEXT,
    slot_emoji TEXT,
    slot_time TIME,
    slot_end_time TIME,
    capacity INTEGER,
    sort_order INTEGER,
    is_active BOOLEAN,
    member_count BIGINT,
    guest_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        es.id AS event_slot_id,
        es.slot_label,
        es.slot_emoji,
        es.slot_time,
        es.slot_end_time,
        es.capacity,
        es.sort_order,
        es.is_active,
        COALESCE((SELECT COUNT(*) FROM attendance a WHERE a.event_id = p_event_id AND a.event_slot_id = es.id), 0) AS member_count,
        COALESCE((SELECT COUNT(*) FROM guest_attendance g WHERE g.event_id = p_event_id AND g.event_slot_id = es.id), 0) AS guest_count
    FROM event_slots es
    WHERE es.event_id = p_event_id
      AND es.is_active = TRUE
    ORDER BY es.sort_order, es.id;
$$;

REVOKE ALL ON FUNCTION get_slot_counts(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_slot_counts(INTEGER) TO anon, authenticated;
