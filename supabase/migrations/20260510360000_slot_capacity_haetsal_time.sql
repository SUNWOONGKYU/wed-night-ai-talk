-- 슬롯별 모집 인원(capacity) 추가 + 햇살 타임 시간/정원 조정
-- 햇살: 15:30-17:00, 6명 (기본값)
-- 노을/달빛: 기존 그대로 (capacity NULL → 프론트에서 events.capacity 폴백)

-- 1. event_slots에 capacity 컬럼 추가
ALTER TABLE event_slots ADD COLUMN IF NOT EXISTS capacity INTEGER;

-- 2. 햇살 슬롯 시간 + 정원 일괄 업데이트
UPDATE event_slots
SET slot_time = '15:30:00',
    slot_end_time = '17:00:00',
    capacity = 6
WHERE slot_label = '햇살';

-- 3. get_slot_counts RPC 재정의 (capacity 포함)
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
        COALESCE((SELECT COUNT(*) FROM inquiries i WHERE i.event_id = p_event_id AND i.event_slot_id = es.id), 0) AS guest_count
    FROM event_slots es
    WHERE es.event_id = p_event_id
      AND es.is_active = TRUE
    ORDER BY es.sort_order, es.id;
$$;

REVOKE ALL ON FUNCTION get_slot_counts(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_slot_counts(INTEGER) TO anon, authenticated;
