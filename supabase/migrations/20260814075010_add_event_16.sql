-- 제16회 모임: 제15회 모임의 운영 설정을 복제해 2026-08-26에 개최한다.
ALTER TABLE public.events
    ALTER COLUMN capacity SET DEFAULT 10;

ALTER TABLE public.event_slots
    ALTER COLUMN capacity SET DEFAULT 10;

DO $$
DECLARE
    source_event public.events%ROWTYPE;
    new_event_id integer;
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.events WHERE event_date = DATE '2026-08-26'
    ) THEN
        RAISE NOTICE '2026-08-26 모임이 이미 존재하여 생성을 건너뜁니다.';
        RETURN;
    END IF;

    SELECT *
      INTO source_event
      FROM public.events
     WHERE event_date = DATE '2026-08-19'
       AND title = '제15회 모임'
     ORDER BY id DESC
     LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION '복제 원본인 제15회 모임(2026-08-19)을 찾을 수 없습니다.';
    END IF;

    INSERT INTO public.events (
        title,
        event_date,
        location,
        description,
        is_active,
        address,
        map_url,
        day_label,
        youtube_url,
        provision,
        capacity
    ) VALUES (
        '제16회 모임',
        DATE '2026-08-26',
        source_event.location,
        source_event.description,
        true,
        source_event.address,
        source_event.map_url,
        'WED',
        source_event.youtube_url,
        replace(
            source_event.provision,
            '제공사항: 커피/생수 포함 다과',
            '제공사항: 커피/생수'
        ),
        10
    )
    RETURNING id INTO new_event_id;

    INSERT INTO public.event_slots (
        event_id,
        slot_label,
        slot_emoji,
        slot_time,
        sort_order,
        is_active,
        slot_end_time,
        capacity
    )
    SELECT
        new_event_id,
        slot_label,
        slot_emoji,
        slot_time,
        sort_order,
        is_active,
        slot_end_time,
        10
      FROM public.event_slots
     WHERE event_id = source_event.id
       AND slot_label = '달빛'
       AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION '제15회 모임의 활성 달빛 슬롯을 찾을 수 없습니다.';
    END IF;
END
$$;

-- 정원이 명시되지 않은 레거시 신청 경로도 새 기본값 10명을 사용한다.
DO $capacity_defaults$
DECLARE
    function_row record;
BEGIN
    FOR function_row IN
        SELECT pg_get_functiondef(p.oid) AS definition
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.prokind = 'f'
           AND p.proname IN (
               'attend_event',
               'attendance_check_capacity',
               'guest_attendance_check_capacity',
               'inquiries_check_capacity'
           )
           AND pg_get_functiondef(p.oid) LIKE '%COALESCE(es.capacity, ev.capacity, 20)%'
    LOOP
        EXECUTE replace(
            function_row.definition,
            'COALESCE(es.capacity, ev.capacity, 20)',
            'COALESCE(es.capacity, ev.capacity, 10)'
        );
    END LOOP;
END
$capacity_defaults$;
