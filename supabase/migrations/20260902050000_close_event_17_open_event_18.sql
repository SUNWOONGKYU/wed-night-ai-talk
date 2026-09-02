-- =============================================
-- 제17회 모임 마감 → 제18회 모임 개설 (2026-09-02, PO 지시)
-- =============================================
--   · 제17회 (2026-09-02) 를 비활성화한다 — 사이트 일정 카드에서 내려간다.
--   · 제18회 를 2026-09-09(수) 로 신설하고, 제17회의 운영 설정과 달빛 슬롯을 복제한다.
--
-- 20260814075010_add_event_16.sql 과 같은 패턴이다. 두 번 실행해도 중복 생성되지
-- 않도록 날짜 존재 여부를 먼저 확인한다.
-- =============================================

DO $$
DECLARE
    source_event public.events%ROWTYPE;
    new_event_id integer;
    slot_count   integer;
BEGIN
    -- ---------- 원본(제17회) 확보 ----------
    SELECT *
      INTO source_event
      FROM public.events
     WHERE event_date = DATE '2026-09-02'
       AND title = '제17회 모임'
     ORDER BY id DESC
     LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION '제17회 모임(2026-09-02)을 찾을 수 없습니다.';
    END IF;

    -- ---------- 1) 제17회 비활성화 ----------
    UPDATE public.events
       SET is_active = false
     WHERE id = source_event.id;

    RAISE NOTICE '[ok] 제17회 모임(id=%) 비활성화', source_event.id;

    -- ---------- 2) 제18회 생성 ----------
    IF EXISTS (SELECT 1 FROM public.events WHERE event_date = DATE '2026-09-09') THEN
        RAISE NOTICE '[skip] 2026-09-09 모임이 이미 존재합니다 — 생성을 건너뜁니다.';
        RETURN;
    END IF;

    INSERT INTO public.events (
        title, event_date, location, description, is_active,
        address, map_url, day_label, youtube_url, provision, capacity
    ) VALUES (
        '제18회 모임',
        DATE '2026-09-09',
        source_event.location,
        source_event.description,
        true,
        source_event.address,
        source_event.map_url,
        'WED',
        NULL,                      -- 지난 회차 영상 링크는 물려받지 않는다
        source_event.provision,
        COALESCE(source_event.capacity, 10)
    )
    RETURNING id INTO new_event_id;

    -- ---------- 3) 달빛 슬롯 복제 ----------
    INSERT INTO public.event_slots (
        event_id, slot_label, slot_emoji, slot_time, slot_end_time,
        sort_order, is_active, capacity
    )
    SELECT
        new_event_id, slot_label, slot_emoji, slot_time, slot_end_time,
        sort_order, true, COALESCE(capacity, 10)
      FROM public.event_slots
     WHERE event_id = source_event.id
       AND is_active = true;

    GET DIAGNOSTICS slot_count = ROW_COUNT;

    IF slot_count = 0 THEN
        RAISE EXCEPTION '제17회 모임의 활성 슬롯을 찾을 수 없습니다 — 제18회에 신청 슬롯이 없습니다.';
    END IF;

    RAISE NOTICE '[ok] 제18회 모임 생성 (id=%, 슬롯 %개)', new_event_id, slot_count;
END
$$;
