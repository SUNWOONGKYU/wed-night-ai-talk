-- =============================================
-- get_slot_attendees: 신청자 이름 가운데 한 글자 가림 (PO 지시, 2026-09-23)
-- =============================================
-- 강의·모임 카드의 신청자 명단이 실명 전체를 보여줘 부담스럽다(PO).
-- 이 함수는 anon 도 부르므로 화면에서만 가리면 개발자도구로 실명이 보인다 → 서버에서 가린다.
--
-- 규칙: 가운데 한 글자만 '*'. 위치 = floor(글자수/2) + 1 (1부터 셈)
--   홍길동 → 홍*동 · 김수 → 김* · 남궁민수 → 남궁*수 · 한 글자는 그대로
-- 본인(is_me) 행은 실명 유지. 관리자 명단(getEventAttendees)은 이 함수를 안 쓰므로 영향 없음.
-- =============================================

CREATE OR REPLACE FUNCTION public.mask_middle_char(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT CASE
        WHEN p_name IS NULL OR char_length(p_name) < 2 THEN p_name
        ELSE overlay(p_name PLACING '*' FROM char_length(p_name) / 2 + 1 FOR 1)
    END;
$$;

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
            CASE WHEN a.user_id = auth.uid() THEN COALESCE(p.name, '회원')
                 ELSE COALESCE(mask_middle_char(p.name), '회원')
            END::TEXT AS name,
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
            COALESCE(mask_middle_char(g.name), '게스트')::TEXT AS name,
            TRUE AS is_guest,
            FALSE AS is_me,
            g.created_at,
            g.id AS row_id
        FROM guest_attendance g
        WHERE g.event_id = p_event_id
          AND g.event_slot_id IS NOT NULL
    ) sub
    WHERE EXISTS (
        SELECT 1 FROM events e
         WHERE e.id = p_event_id
           AND (e.is_active = true OR public.is_admin())
    )
    ORDER BY created_at ASC, is_guest ASC, name ASC, row_id ASC;
$$;

GRANT EXECUTE ON FUNCTION get_slot_attendees(INTEGER) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 검증 — 실패하면 롤백
-- ---------------------------------------------------------------------------
DO $verify$
BEGIN
    IF mask_middle_char('홍길동')   <> '홍*동'   THEN RAISE EXCEPTION '[검증실패] 3글자'; END IF;
    IF mask_middle_char('김수')     <> '김*'     THEN RAISE EXCEPTION '[검증실패] 2글자'; END IF;
    IF mask_middle_char('남궁민수') <> '남궁*수' THEN RAISE EXCEPTION '[검증실패] 4글자'; END IF;
    IF mask_middle_char('이')       <> '이'      THEN RAISE EXCEPTION '[검증실패] 1글자'; END IF;
    IF mask_middle_char(NULL) IS NOT NULL        THEN RAISE EXCEPTION '[검증실패] NULL'; END IF;
    RAISE NOTICE '[ok] mask_middle_char 규칙 확인';
END
$verify$;
