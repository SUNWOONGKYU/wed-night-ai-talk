-- get_slot_attendees: 동시각·동명이인 모두 결정적 정렬 보장
-- 변경: ORDER BY에 attendance.id (회원) / guest_attendance.id (게스트) 보조키 추가
-- 결정성 보장: 같은 회원/게스트 row는 id가 유일하므로 정렬 결과 100% 재현 가능

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
    SELECT
        event_slot_id, name, is_guest, is_me, created_at
    FROM (
        SELECT
            a.event_slot_id::INTEGER,
            COALESCE(p.name, '회원')::TEXT AS name,
            FALSE AS is_guest,
            (a.user_id = auth.uid()) AS is_me,
            a.created_at,
            a.id AS row_id
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
            g.created_at,
            g.id AS row_id
        FROM guest_attendance g
        WHERE g.event_id = p_event_id
          AND g.event_slot_id IS NOT NULL
    ) sub
    ORDER BY created_at ASC, is_guest ASC, name ASC, row_id ASC;
$$;

GRANT EXECUTE ON FUNCTION get_slot_attendees(INTEGER) TO anon, authenticated;
