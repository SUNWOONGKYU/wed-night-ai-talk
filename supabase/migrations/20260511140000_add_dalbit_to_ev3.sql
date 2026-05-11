-- 1회차(ev=3)에 누락된 달빛 슬롯 추가 (active=true)
-- 이미 비활성 상태로 존재하면 재활성화, 없으면 신규 INSERT

DO $$
DECLARE
    v_existing_id INTEGER;
BEGIN
    SELECT id INTO v_existing_id
    FROM event_slots
    WHERE event_id = 3 AND slot_label = '달빛'
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        UPDATE event_slots
        SET is_active = true,
            slot_time = '20:00:00',
            slot_end_time = '22:00:00',
            slot_emoji = '🌙',
            sort_order = 3
        WHERE id = v_existing_id;
    ELSE
        INSERT INTO event_slots (event_id, slot_label, slot_emoji, slot_time, slot_end_time, sort_order, is_active)
        VALUES (3, '달빛', '🌙', '20:00:00', '22:00:00', 3, true);
    END IF;
END $$;
