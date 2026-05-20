-- =============================================
-- 제5회 모임 추가 (2026-06-10, 수요일) - 2026-05-20
-- =============================================
-- 슬롯: 햇살(15:30~17:30, 정원 6) / 달빛(19:00~21:30, 정원 20)
-- 노을은 이전 회차부터 폐지된 정책 그대로 적용하지 않음.
-- 장소·설명·제공사항은 제4회(id=6)와 동일하게 복사.
-- =============================================

DO $$
DECLARE
    base RECORD;
    new_id INTEGER;
BEGIN
    -- 중복 생성 방지
    IF EXISTS (SELECT 1 FROM events WHERE event_date = '2026-06-10') THEN
        RAISE NOTICE '이미 2026-06-10 모임이 존재 — 추가 생성 skip';
        RETURN;
    END IF;

    -- 제4회를 템플릿으로 사용
    SELECT location, address, map_url, description, provision
    INTO base
    FROM events WHERE id = 6;

    INSERT INTO events (title, event_date, day_label, location, address, map_url,
                        description, provision, youtube_url, is_active)
    VALUES ('제5회 모임', '2026-06-10', 'WED',
            base.location, base.address, base.map_url,
            base.description, base.provision, NULL, true)
    RETURNING id INTO new_id;

    -- 햇살 / 달빛 두 슬롯만 (노을 폐지 정책 반영)
    INSERT INTO event_slots (event_id, slot_label, slot_emoji, slot_time, slot_end_time,
                             sort_order, is_active, capacity)
    VALUES
        (new_id, '햇살', '☀️', '15:30', '17:30', 1, true, 6),
        (new_id, '달빛', '🌙', '19:00', '21:30', 2, true, 20);

    RAISE NOTICE '제5회 모임 생성 완료: event_id=%', new_id;
END $$;
