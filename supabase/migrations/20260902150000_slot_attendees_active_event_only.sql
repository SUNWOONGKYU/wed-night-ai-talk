-- =============================================
-- get_slot_attendees: 활성 모임으로 제한 (PO 승인, 2026-09-02)
-- =============================================
-- 2026-09-02 에 attendance 테이블 직접조회를 막았는데(20260902040000), 이 RPC 는
-- SECURITY DEFINER 라 RLS 를 우회한다. 그래서 임의의 event_id 를 넣으면
-- 지난 회차 참석자 이름과 신청 시각(초 단위)이 그대로 나왔다.
--   실측: rpc/get_slot_attendees {"p_event_id":3} → 2026-05 회차 참석자 명단 반환
--
-- 화면이 요구하는 범위는 '현재 열려 있는 모임의 신청자 명단'이다 — 누가 오는지 보고
-- 참석 여부를 판단하라는 사회적 증명 목적(PO). 지난 회차 이력은 화면 어디에도 쓰지 않는다.
-- 즉 '공개하기로 한 것'과 '실제로 나갈 수 있는 것'이 어긋나 있었다.
--
-- 조치 — 활성 모임(events.is_active = true)만 돌려준다. 관리자는 예외로 전부 볼 수 있다.
--   · 화면 영향 없음: js/main.js 는 활성 이벤트만 순회하며 이 함수를 부른다.
--   · 관리자 신청자 명단은 이 함수가 아니라 getEventAttendees(테이블 조회)를 쓰지만,
--     지난 회차 점검용으로 이 함수를 부를 여지를 남겨 둔다.
-- =============================================

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
    -- 활성 모임이 아니면 아무것도 돌려주지 않는다 (관리자는 예외).
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
DECLARE
    v_active   integer;
    v_inactive integer;
    n_active   integer;
    n_inactive integer;
BEGIN
    SELECT id INTO v_active   FROM events WHERE is_active = true  ORDER BY id DESC LIMIT 1;
    -- 참석자가 실제로 있는 비활성 모임을 고른다 (없는 모임으로는 검증이 안 된다)
    SELECT e.id INTO v_inactive
      FROM events e
     WHERE e.is_active = false
       AND EXISTS (SELECT 1 FROM attendance a WHERE a.event_id = e.id AND a.event_slot_id IS NOT NULL)
     ORDER BY e.id DESC LIMIT 1;

    IF v_inactive IS NULL THEN
        RAISE EXCEPTION '[검증불가] 참석자가 있는 비활성 모임이 없어 차단을 확인할 수 없다';
    END IF;

    SELECT count(*) INTO n_inactive FROM get_slot_attendees(v_inactive);
    IF n_inactive <> 0 THEN
        RAISE EXCEPTION '[검증실패] 비활성 모임(%)이 아직 %건을 돌려준다', v_inactive, n_inactive;
    END IF;

    -- 활성 모임은 계속 동작해야 한다. 신청자가 0명일 수 있으므로 '오류 없이 실행'만 본다.
    IF v_active IS NOT NULL THEN
        SELECT count(*) INTO n_active FROM get_slot_attendees(v_active);
        RAISE NOTICE '[ok] 활성 모임(%) %건 / 비활성 모임(%) 0건', v_active, n_active, v_inactive;
    END IF;
END
$verify$;
