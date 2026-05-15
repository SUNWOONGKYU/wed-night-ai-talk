-- get_slot_attendees: 본인 식별을 위한 is_me 컬럼 추가
-- ⚠️ NOTE: 이 함수 시그니처는 050000 마이그레이션에서 결정적 정렬(ORDER BY id 포함)로 교체됨.
--          최종 정의는 20260514060000_slot_attendees_tiebreak_id.sql 참조.
-- 본 파일은 마이그레이션 이력 보존을 위해 남겨둠.
-- user_id 자체는 노출하지 않고, 서버 측에서 auth.uid() 비교 결과만 boolean으로 반환
-- 이름 문자열 비교(동명이인 취약)를 서버 신뢰 기반으로 교체

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
    -- 회원 신청
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

    -- 게스트 신청
    SELECT
        g.event_slot_id::INTEGER,
        COALESCE(g.name, '게스트')::TEXT AS name,
        TRUE AS is_guest,
        FALSE AS is_me,
        g.created_at
    FROM guest_attendance g
    WHERE g.event_id = p_event_id
      AND g.event_slot_id IS NOT NULL

    ORDER BY 5 ASC;  -- created_at 순
$$;

GRANT EXECUTE ON FUNCTION get_slot_attendees(INTEGER) TO anon, authenticated;
