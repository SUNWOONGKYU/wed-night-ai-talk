-- 슬롯별 신청자 명단 RPC
-- 공개 데이터: name만 반환 (전화/이메일 제외)
-- 회원·게스트 통합. 신청 시간(created_at) 순.

DROP FUNCTION IF EXISTS get_slot_attendees(INTEGER);

CREATE OR REPLACE FUNCTION get_slot_attendees(p_event_id INTEGER)
RETURNS TABLE (
    event_slot_id INTEGER,
    name TEXT,
    is_guest BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    -- 회원 신청
    SELECT
        a.event_slot_id::INTEGER,
        COALESCE(p.name, '회원')::TEXT AS name,
        FALSE AS is_guest,
        a.created_at
    FROM attendance a
    LEFT JOIN profiles p ON p.id = a.user_id
    WHERE a.event_id = p_event_id
      AND a.event_slot_id IS NOT NULL

    UNION ALL

    -- 게스트 신청
    SELECT
        g.event_slot_id::INTEGER,
        COALESCE(g.name, '게스트')::TEXT AS name,
        TRUE AS is_guest,
        g.created_at
    FROM guest_attendance g
    WHERE g.event_id = p_event_id
      AND g.event_slot_id IS NOT NULL

    ORDER BY 4 ASC;  -- created_at 순
$$;

GRANT EXECUTE ON FUNCTION get_slot_attendees(INTEGER) TO anon, authenticated;

-- 내 신청 전체 (프로필 페이지용) — 회원 본인의 모든 모임 신청 현황
DROP FUNCTION IF EXISTS get_my_attendances();

CREATE OR REPLACE FUNCTION get_my_attendances()
RETURNS TABLE (
    attendance_id INTEGER,
    event_id INTEGER,
    event_slot_id INTEGER,
    event_date DATE,
    event_title TEXT,
    is_active BOOLEAN,
    slot_label TEXT,
    slot_emoji TEXT,
    slot_time TEXT,
    slot_end_time TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        a.id::INTEGER AS attendance_id,
        a.event_id::INTEGER,
        a.event_slot_id::INTEGER,
        ev.event_date,
        ev.title::TEXT AS event_title,
        ev.is_active,
        es.slot_label::TEXT,
        es.slot_emoji::TEXT,
        es.slot_time::TEXT,
        es.slot_end_time::TEXT,
        a.created_at
    FROM attendance a
    JOIN events ev ON ev.id = a.event_id
    LEFT JOIN event_slots es ON es.id = a.event_slot_id
    WHERE a.user_id = auth.uid()
    ORDER BY ev.event_date ASC, es.sort_order ASC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION get_my_attendances() TO authenticated;
