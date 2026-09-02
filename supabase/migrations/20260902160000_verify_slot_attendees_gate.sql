-- =============================================
-- [검증 전용] get_slot_attendees 활성/비활성 게이트가 정확히 동작하는지 확인 (2026-09-02)
-- =============================================
-- 20260902150000 로 비활성 모임이 0건을 돌려주는 것은 확인했다. 그런데 현재 활성
-- 모임(제18회)은 아직 신청자가 0명이라 "활성이면 여전히 명단이 나온다"를 증명하지
-- 못했다 — 0건이 '차단돼서 0'인지 '원래 0명이라 0'인지 구분이 안 된다.
--
-- 그래서 참석자가 있는 지난 모임을 트랜잭션 안에서 잠깐 활성으로 바꿔 호출해 보고,
-- 곧바로 되돌린다. 중첩 블록의 EXCEPTION 핸들러가 savepoint 역할을 하므로
-- UPDATE 는 롤백되고, PL/pgSQL 변수 값은 남는다(변수는 트랜잭션 대상이 아니다).
--
-- ⚠️ 데이터를 영구히 바꾸지 않는다. 사이트에 지난 모임이 노출되는 일도 없다.
-- =============================================

DO $verify$
DECLARE
    v_event    integer;
    n_blocked  integer;
    n_allowed  integer := -1;
BEGIN
    -- 참석자가 있는 비활성 모임 하나
    SELECT e.id INTO v_event
      FROM events e
     WHERE e.is_active = false
       AND EXISTS (SELECT 1 FROM attendance a
                    WHERE a.event_id = e.id AND a.event_slot_id IS NOT NULL)
     ORDER BY e.id DESC
     LIMIT 1;

    IF v_event IS NULL THEN
        RAISE EXCEPTION '[검증불가] 참석자가 있는 비활성 모임이 없다';
    END IF;

    -- (1) 비활성 상태 → 0건이어야 한다
    SELECT count(*) INTO n_blocked FROM get_slot_attendees(v_event);

    -- (2) 같은 모임을 잠깐 활성으로 바꿔 호출 → 0건보다 커야 한다
    BEGIN
        UPDATE events SET is_active = true WHERE id = v_event;
        SELECT count(*) INTO n_allowed FROM get_slot_attendees(v_event);
        -- 일부러 실패시켜 위 UPDATE 를 되돌린다
        RAISE EXCEPTION 'rollback-probe';
    EXCEPTION WHEN OTHERS THEN
        NULL;   -- UPDATE 롤백됨. n_allowed 값은 변수라 그대로 남는다.
    END;

    -- 되돌아갔는지 확인
    IF (SELECT is_active FROM events WHERE id = v_event) THEN
        RAISE EXCEPTION '[검증실패] 시험용으로 켠 모임(%)이 활성인 채로 남았다', v_event;
    END IF;

    IF n_blocked <> 0 THEN
        RAISE EXCEPTION '[검증실패] 비활성 모임(%)이 %건을 돌려준다', v_event, n_blocked;
    END IF;

    IF n_allowed <= 0 THEN
        RAISE EXCEPTION '[검증실패] 활성으로 바꿨는데도 %건 — 게이트가 아니라 함수가 망가진 것이다', n_allowed;
    END IF;

    RAISE NOTICE '[ok] 모임 % — 비활성 %건 / 활성 %건 (게이트 정상, 데이터 원복 확인)',
                 v_event, n_blocked, n_allowed;
END
$verify$;
