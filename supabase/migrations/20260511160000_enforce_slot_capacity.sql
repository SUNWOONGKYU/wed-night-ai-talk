-- 슬롯 정원(capacity) 초과 신청 차단
-- 1) attend_event RPC: 회원 신청 시 capacity 체크
-- 2) inquiries BEFORE INSERT 트리거: 게스트 신청 시 capacity 체크
--
-- 정원 = event_slots.capacity (NULL이면 events.capacity, 둘 다 NULL이면 20)
-- 현재 점유 = attendance(member) + inquiries(guest) 합산

CREATE OR REPLACE FUNCTION attend_event(
    p_event_id INTEGER,
    p_event_slot_id INTEGER DEFAULT NULL,
    p_note TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cap INTEGER;
    v_taken INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF p_event_slot_id IS NULL THEN
        RAISE EXCEPTION '타임 슬롯을 먼저 선택해주세요.';
    END IF;

    -- 이미 신청한 슬롯이면 capacity 체크 스킵 (idempotent)
    IF EXISTS (
        SELECT 1 FROM attendance
        WHERE user_id = auth.uid() AND event_id = p_event_id AND event_slot_id = p_event_slot_id
    ) THEN
        RETURN;
    END IF;

    -- capacity 계산: slot.capacity → event.capacity → 20
    SELECT COALESCE(es.capacity, ev.capacity, 20) INTO v_cap
    FROM event_slots es
    JOIN events ev ON ev.id = es.event_id
    WHERE es.id = p_event_slot_id;

    -- 현재 점유 인원 (회원 + 게스트)
    SELECT
        COALESCE((SELECT COUNT(*) FROM attendance a WHERE a.event_slot_id = p_event_slot_id), 0)
      + COALESCE((SELECT COUNT(*) FROM inquiries i WHERE i.event_slot_id = p_event_slot_id), 0)
    INTO v_taken;

    IF v_taken >= v_cap THEN
        RAISE EXCEPTION '해당 시간대는 마감되었습니다. 다른 시간대를 선택해주세요. (정원 %명)', v_cap;
    END IF;

    INSERT INTO attendance (user_id, event_id, event_slot_id, note)
    VALUES (auth.uid(), p_event_id, p_event_slot_id, COALESCE(p_note, ''))
    ON CONFLICT ON CONSTRAINT attendance_user_event_slot_uniq DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION attend_event(INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION attend_event(INTEGER, INTEGER, TEXT) TO authenticated;


-- 게스트 신청 capacity 체크 트리거
CREATE OR REPLACE FUNCTION inquiries_check_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cap INTEGER;
    v_taken INTEGER;
BEGIN
    -- 슬롯 지정 없는 일반 문의는 통과
    IF NEW.event_slot_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(es.capacity, ev.capacity, 20) INTO v_cap
    FROM event_slots es
    JOIN events ev ON ev.id = es.event_id
    WHERE es.id = NEW.event_slot_id;

    IF v_cap IS NULL THEN
        -- 슬롯 정보를 못 찾으면 차단하지 않음
        RETURN NEW;
    END IF;

    SELECT
        COALESCE((SELECT COUNT(*) FROM attendance a WHERE a.event_slot_id = NEW.event_slot_id), 0)
      + COALESCE((SELECT COUNT(*) FROM inquiries i WHERE i.event_slot_id = NEW.event_slot_id), 0)
    INTO v_taken;

    IF v_taken >= v_cap THEN
        RAISE EXCEPTION '해당 시간대는 마감되었습니다. 다른 시간대를 선택해주세요. (정원 %명)', v_cap;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inquiries_capacity_check ON inquiries;
CREATE TRIGGER inquiries_capacity_check
    BEFORE INSERT ON inquiries
    FOR EACH ROW
    EXECUTE FUNCTION inquiries_check_capacity();
