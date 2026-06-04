-- =============================================
-- 제4회(2026-06-03) 비활성화 + 제5회(2026-06-10) 복제 → 제6회(2026-06-17)
-- 2026-06-04
-- =============================================
-- PO 요청: 어제 끝난 모임 비활성화 + 5회와 동일한 방식으로 6회 추가
-- 슬롯·정원·시간·장소·내용·참가비 모두 5회와 동일
-- =============================================

DO $$
DECLARE
    v_e5_id INTEGER;
    v_e6_id INTEGER;
    v_cols TEXT;
    v_slot_cols TEXT;
BEGIN
    -- 1) 제4회(2026-06-03) 비활성화
    UPDATE events SET is_active = false WHERE event_date = '2026-06-03';
    RAISE NOTICE '[1] 2026-06-03 모임 비활성화 (%건)', (SELECT count(*) FROM events WHERE event_date = '2026-06-03' AND is_active = false);

    -- 2) 제5회 ID
    SELECT id INTO v_e5_id FROM events WHERE event_date = '2026-06-10' LIMIT 1;
    IF v_e5_id IS NULL THEN
        RAISE EXCEPTION '[err] 2026-06-10 (제5회) 모임 없음';
    END IF;
    RAISE NOTICE '[2] 제5회 event_id=%', v_e5_id;

    -- 3) 제6회 이미 있으면 스킵
    IF EXISTS (SELECT 1 FROM events WHERE event_date = '2026-06-17') THEN
        RAISE NOTICE '[skip] 2026-06-17 (제6회) 이미 존재 — 생성 건너뜀';
        RETURN;
    END IF;

    -- 4) events 컬럼 자동 수집 (id·created_at 제외 — 자동 생성)
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
      INTO v_cols
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events'
       AND column_name NOT IN ('id', 'created_at');

    -- 5) 제5회 복제 → 제6회 (RETURNING으로 새 id 획득)
    EXECUTE format(
        'INSERT INTO events (%s) SELECT %s FROM events WHERE id = $1 RETURNING id',
        v_cols, v_cols
    ) INTO v_e6_id USING v_e5_id;

    -- 6) event_date 만 +7일로 조정 (제6회 활성)
    UPDATE events SET event_date = '2026-06-17', is_active = true WHERE id = v_e6_id;
    RAISE NOTICE '[3] 제6회 event_id=% 생성 (event_date=2026-06-17)', v_e6_id;

    -- 7) event_slots 컬럼 자동 수집 (id·created_at·event_id 제외 — event_id는 새 값으로 대체)
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
      INTO v_slot_cols
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_slots'
       AND column_name NOT IN ('id', 'created_at', 'event_id');

    -- 8) 제5회의 슬롯 모두 복제 (정원·시간·이모지 그대로)
    EXECUTE format(
        'INSERT INTO event_slots (event_id, %s) SELECT $1, %s FROM event_slots WHERE event_id = $2',
        v_slot_cols, v_slot_cols
    ) USING v_e6_id, v_e5_id;

    RAISE NOTICE '[4] 제6회 슬롯 %개 복제 완료', (SELECT count(*) FROM event_slots WHERE event_id = v_e6_id);
END $$;
