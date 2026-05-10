-- 슬롯 종료 시간 추가 (시작~종료 표시용)

ALTER TABLE event_slots ADD COLUMN IF NOT EXISTS slot_end_time TIME;

-- 기존 디폴트 슬롯에 종료 시간 채우기
UPDATE event_slots SET slot_end_time = '17:00:00' WHERE slot_label = '햇살' AND slot_end_time IS NULL;
UPDATE event_slots SET slot_end_time = '19:30:00' WHERE slot_label = '노을' AND slot_end_time IS NULL;
UPDATE event_slots SET slot_end_time = '22:00:00' WHERE slot_label = '달빛' AND slot_end_time IS NULL;

-- get_slot_counts RPC: slot_end_time 포함하여 재정의
DROP FUNCTION IF EXISTS get_slot_counts(INTEGER);

CREATE OR REPLACE FUNCTION get_slot_counts(p_event_id INTEGER)
RETURNS TABLE(
    event_slot_id INTEGER,
    slot_label TEXT,
    slot_emoji TEXT,
    slot_time TIME,
    slot_end_time TIME,
    sort_order INTEGER,
    is_active BOOLEAN,
    member_count BIGINT,
    guest_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        es.id AS event_slot_id,
        es.slot_label,
        es.slot_emoji,
        es.slot_time,
        es.slot_end_time,
        es.sort_order,
        es.is_active,
        COALESCE((SELECT COUNT(*) FROM attendance a WHERE a.event_id = p_event_id AND a.event_slot_id = es.id), 0) AS member_count,
        COALESCE((SELECT COUNT(*) FROM inquiries i WHERE i.event_id = p_event_id AND i.event_slot_id = es.id), 0) AS guest_count
    FROM event_slots es
    WHERE es.event_id = p_event_id
      AND es.is_active = TRUE
    ORDER BY es.sort_order, es.id;
$$;

REVOKE ALL ON FUNCTION get_slot_counts(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_slot_counts(INTEGER) TO anon, authenticated;
