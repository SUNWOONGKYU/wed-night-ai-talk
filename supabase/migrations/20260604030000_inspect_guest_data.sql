-- 진단: guest_attendance 보존 확인 (변경 없음, RAISE NOTICE만)
DO $$
DECLARE
    v_total INT;
    r RECORD;
BEGIN
    SELECT count(*) INTO v_total FROM guest_attendance;
    RAISE NOTICE '[진단] guest_attendance 총 %건', v_total;

    FOR r IN
        SELECT ga.id, ga.name, ga.event_id, e.event_date, e.is_active,
               es.slot_label, ga.created_at
          FROM guest_attendance ga
          JOIN events e ON e.id = ga.event_id
          JOIN event_slots es ON es.id = ga.event_slot_id
         ORDER BY ga.created_at DESC
    LOOP
        RAISE NOTICE '  - id=% name="%" event_date=% (active=%) slot=%',
                     r.id, r.name, r.event_date, r.is_active, r.slot_label;
    END LOOP;
END $$;
