-- attendance 테이블에 BEFORE INSERT 트리거 추가
-- 기존: capacity 체크는 attend_event RPC에만 존재 → 관리자 수동 INSERT/race condition 우회 가능
-- 신규: 테이블 레벨 트리거로 모든 INSERT 경로 차단

CREATE OR REPLACE FUNCTION attendance_check_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cap INTEGER;
    v_taken INTEGER;
BEGIN
    IF NEW.event_slot_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(es.capacity, ev.capacity, 20) INTO v_cap
    FROM event_slots es
    JOIN events ev ON ev.id = es.event_id
    WHERE es.id = NEW.event_slot_id;

    IF v_cap IS NULL THEN
        RETURN NEW;
    END IF;

    -- 본인의 기존 행은 제외 (idempotent UPDATE/INSERT용)
    SELECT
        COALESCE((
            SELECT COUNT(*) FROM attendance a
            WHERE a.event_slot_id = NEW.event_slot_id
              AND (TG_OP = 'INSERT' OR a.id <> NEW.id)
        ), 0)
      + COALESCE((
            SELECT COUNT(*) FROM guest_attendance g
            WHERE g.event_slot_id = NEW.event_slot_id
        ), 0)
    INTO v_taken;

    IF v_taken >= v_cap THEN
        RAISE EXCEPTION '해당 시간대는 마감되었습니다. (정원 %명)', v_cap;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_capacity_check ON attendance;
CREATE TRIGGER attendance_capacity_check
    BEFORE INSERT OR UPDATE OF event_slot_id ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION attendance_check_capacity();
