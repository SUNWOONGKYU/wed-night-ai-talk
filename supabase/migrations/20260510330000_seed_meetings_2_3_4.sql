-- 제2~4회 모임 자동 생성 (매주 수요일)
-- 1회: 2026-05-13 (수) — 기존
-- 2회: 2026-05-20 (수)
-- 3회: 2026-05-27 (수)
-- 4회: 2026-06-03 (수)

DO $$
DECLARE
    base_event RECORD;
    new_id INTEGER;
    meetings JSONB := '[
        {"title": "제2회 모임", "date": "2026-05-20"},
        {"title": "제3회 모임", "date": "2026-05-27"},
        {"title": "제4회 모임", "date": "2026-06-03"}
    ]'::jsonb;
    m JSONB;
BEGIN
    -- 1회 모임을 템플릿으로 사용
    SELECT * INTO base_event FROM events
    WHERE event_date = '2026-05-13' AND is_active = true LIMIT 1;

    IF base_event.id IS NULL THEN
        RAISE EXCEPTION '1회 모임을 찾을 수 없음';
    END IF;

    FOR m IN SELECT * FROM jsonb_array_elements(meetings) LOOP
        -- 이미 있으면 skip
        IF EXISTS (SELECT 1 FROM events WHERE event_date = (m->>'date')::date) THEN
            CONTINUE;
        END IF;

        INSERT INTO events (
            title, event_date, day_label, location, address, map_url,
            description, provision, youtube_url, is_active
        )
        VALUES (
            m->>'title',
            (m->>'date')::date,
            'WED',
            base_event.location,
            base_event.address,
            base_event.map_url,
            base_event.description,
            base_event.provision,
            NULL,
            true
        )
        RETURNING id INTO new_id;

        -- 디폴트 3슬롯 시드
        INSERT INTO event_slots (event_id, slot_label, slot_emoji, slot_time, slot_end_time, sort_order, is_active)
        VALUES
            (new_id, '햇살', '☀️', '15:00', '17:00', 1, true),
            (new_id, '노을', '🌅', '17:30', '19:30', 2, true),
            (new_id, '달빛', '🌙', '20:00', '22:00', 3, true);

        RAISE NOTICE '신규 모임 생성: id=% title=% date=%', new_id, m->>'title', m->>'date';
    END LOOP;
END $$;
