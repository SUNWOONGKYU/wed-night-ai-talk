DO $$
DECLARE
    target_event_id integer;
BEGIN
    SELECT id
      INTO target_event_id
      FROM public.events
     WHERE event_date = DATE '2026-08-19'
       AND title = '제15회 모임'
     ORDER BY id DESC
     LIMIT 1;

    IF target_event_id IS NULL THEN
        RAISE EXCEPTION '제15회 모임(2026-08-19)을 찾을 수 없습니다.';
    END IF;

    UPDATE public.events
       SET capacity = 10,
           provision = replace(
               provision,
               '제공사항: 커피/생수 포함 다과',
               '제공사항: 커피/생수'
           )
     WHERE id = target_event_id;

    UPDATE public.event_slots
       SET capacity = 10
     WHERE event_id = target_event_id
       AND slot_label = '달빛';

    IF NOT FOUND THEN
        RAISE EXCEPTION '제15회 모임의 달빛 슬롯을 찾을 수 없습니다.';
    END IF;
END
$$;
