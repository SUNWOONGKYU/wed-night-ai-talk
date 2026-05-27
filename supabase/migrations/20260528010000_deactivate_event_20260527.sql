-- =============================================
-- 2026-05-27 모임 비활성화 - 2026-05-28
-- =============================================
-- PO 요청: 5월 27일(수) 모임을 비활성화한다.
-- =============================================

DO $$
DECLARE
    v_event_id INTEGER;
    v_title TEXT;
    v_was_active BOOLEAN;
BEGIN
    SELECT id, title, is_active
      INTO v_event_id, v_title, v_was_active
      FROM events
     WHERE event_date = '2026-05-27'
     LIMIT 1;

    IF v_event_id IS NULL THEN
        RAISE NOTICE '[skip] 2026-05-27 이벤트 없음 — 변경사항 없음';
    ELSE
        UPDATE events
           SET is_active = false
         WHERE id = v_event_id;

        RAISE NOTICE '[ok] event_id=% title="%" is_active: % → false',
                     v_event_id, v_title, v_was_active;
    END IF;
END $$;
