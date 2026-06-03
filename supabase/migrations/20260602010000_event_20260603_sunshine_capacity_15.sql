-- =============================================
-- 2026-06-03 햇살 슬롯 정원 15명으로 변경 - 2026-06-02
-- =============================================

DO $$
DECLARE
    v_slot_id BIGINT;
    v_old_cap INT;
BEGIN
    SELECT es.id, es.capacity
      INTO v_slot_id, v_old_cap
      FROM event_slots es
      JOIN events e ON e.id = es.event_id
     WHERE e.event_date = '2026-06-03'
       AND es.slot_label = '햇살'
     LIMIT 1;

    IF v_slot_id IS NULL THEN
        RAISE EXCEPTION '[err] 2026-06-03 햇살 슬롯 없음';
    END IF;

    UPDATE event_slots SET capacity = 15 WHERE id = v_slot_id;
    RAISE NOTICE '[ok] slot_id=% capacity: % → 15', v_slot_id, v_old_cap;
END $$;
