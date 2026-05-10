-- 참여자 현황 디버깅
DO $$
DECLARE
    rec RECORD;
    cnt INTEGER;
BEGIN
    RAISE NOTICE '=== events ===';
    FOR rec IN SELECT id, title, event_date FROM events ORDER BY event_date DESC LOOP
        RAISE NOTICE 'event_id=% title=% date=%', rec.id, rec.title, rec.event_date;
    END LOOP;

    RAISE NOTICE '=== event_slots ===';
    FOR rec IN SELECT id, event_id, slot_label, slot_emoji, sort_order, is_active FROM event_slots ORDER BY event_id, sort_order LOOP
        RAISE NOTICE 'slot_id=% event_id=% label=% sort=% active=%', rec.id, rec.event_id, rec.slot_label, rec.sort_order, rec.is_active;
    END LOOP;

    SELECT COUNT(*) INTO cnt FROM attendance;
    RAISE NOTICE '=== attendance 총 % rows ===', cnt;
    FOR rec IN SELECT id, user_id, event_id, event_slot_id FROM attendance LIMIT 20 LOOP
        RAISE NOTICE 'att id=% user=% event=% event_slot=%', rec.id, rec.user_id, rec.event_id, rec.event_slot_id;
    END LOOP;

    SELECT COUNT(*) INTO cnt FROM inquiries WHERE event_id IS NOT NULL;
    RAISE NOTICE '=== inquiries with event_id 총 % rows ===', cnt;
    FOR rec IN SELECT id, name, event_id, event_slot_id FROM inquiries WHERE event_id IS NOT NULL LIMIT 20 LOOP
        RAISE NOTICE 'inq id=% name=% event=% event_slot=%', rec.id, rec.name, rec.event_id, rec.event_slot_id;
    END LOOP;
END $$;
