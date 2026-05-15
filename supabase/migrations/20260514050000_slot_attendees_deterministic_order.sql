-- get_slot_attendees: 동시각 신청 시 결정적 정렬 보장
-- 기존: ORDER BY created_at — 동시각이면 비결정적
-- 개선: ORDER BY created_at, is_guest, name (회원이 게스트보다 앞)

DROP FUNCTION IF EXISTS get_slot_attendees(INTEGER);

CREATE OR REPLACE FUNCTION get_slot_attendees(p_event_id INTEGER)
RETURNS TABLE (
    event_slot_id INTEGER,
    name TEXT,
    is_guest BOOLEAN,
    is_me BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM (
        SELECT
            a.event_slot_id::INTEGER,
            COALESCE(p.name, '회원')::TEXT AS name,
            FALSE AS is_guest,
            (a.user_id = auth.uid()) AS is_me,
            a.created_at
        FROM attendance a
        LEFT JOIN profiles p ON p.id = a.user_id
        WHERE a.event_id = p_event_id
          AND a.event_slot_id IS NOT NULL

        UNION ALL

        SELECT
            g.event_slot_id::INTEGER,
            COALESCE(g.name, '게스트')::TEXT AS name,
            TRUE AS is_guest,
            FALSE AS is_me,
            g.created_at
        FROM guest_attendance g
        WHERE g.event_id = p_event_id
          AND g.event_slot_id IS NOT NULL
    ) sub
    ORDER BY created_at ASC, is_guest ASC, name ASC;
$$;

GRANT EXECUTE ON FUNCTION get_slot_attendees(INTEGER) TO anon, authenticated;
