-- 강의(event_type='event') 신청 마감 = 강의 시작 시각 (PO, 2026-09-15).
-- apply_deadline(날짜)은 그보다 이르게 따로 끊고 싶을 때만 쓰는 선택 항목으로 남긴다.
-- 본문은 20260913010000 버전 + "강의 시작 이후 거부" 블록 하나.
CREATE OR REPLACE FUNCTION public.attend_event(
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
    v_deadline DATE;
    v_type TEXT;
    v_date DATE;
    v_start TIME;
    v_now_kst TIMESTAMP := (now() AT TIME ZONE 'Asia/Seoul');
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF p_event_slot_id IS NULL THEN
        RAISE EXCEPTION '타임 슬롯을 먼저 선택해주세요.';
    END IF;

    SELECT e.apply_deadline, e.event_type, e.event_date, s.slot_time
      INTO v_deadline, v_type, v_date, v_start
      FROM events e
      LEFT JOIN event_slots s ON s.id = p_event_slot_id
     WHERE e.id = p_event_id;

    -- 신청 마감일 (KST 당일까지 허용)
    IF v_deadline IS NOT NULL AND v_now_kst::date > v_deadline THEN
        RAISE EXCEPTION '신청이 마감되었습니다. (마감일 %)', to_char(v_deadline, 'YYYY-MM-DD');
    END IF;

    -- 강의는 시작 시각 이후 신청 불가
    IF v_type = 'event' AND v_date IS NOT NULL AND v_start IS NOT NULL
       AND v_now_kst >= (v_date + v_start) THEN
        RAISE EXCEPTION '강의가 시작되어 신청이 마감되었습니다.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM attendance
        WHERE user_id = auth.uid() AND event_id = p_event_id AND event_slot_id = p_event_slot_id
    ) THEN
        RETURN;
    END IF;

    SELECT COALESCE(es.capacity, ev.capacity, 20) INTO v_cap
    FROM event_slots es
    JOIN events ev ON ev.id = es.event_id
    WHERE es.id = p_event_slot_id;

    SELECT
        COALESCE((SELECT COUNT(*) FROM attendance a WHERE a.event_slot_id = p_event_slot_id), 0)
      + COALESCE((SELECT COUNT(*) FROM guest_attendance g WHERE g.event_slot_id = p_event_slot_id), 0)
    INTO v_taken;

    IF v_taken >= v_cap THEN
        RAISE EXCEPTION '해당 시간대는 마감되었습니다. 다른 시간대를 선택해주세요. (정원 %명)', v_cap;
    END IF;

    INSERT INTO attendance (user_id, event_id, event_slot_id, note)
    VALUES (auth.uid(), p_event_id, p_event_slot_id, COALESCE(p_note, ''))
    ON CONFLICT ON CONSTRAINT attendance_user_event_slot_uniq DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.attend_event(INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attend_event(INTEGER, INTEGER, TEXT) TO authenticated;
