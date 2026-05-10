-- 2026-05-10: 1차 정기 모임 일자 확정 (2026-05-13 수요일)
UPDATE events
SET event_date = '2026-05-13',
    day_label = 'WED',
    title = '1차 모임'
WHERE id = (
    SELECT id FROM events
    WHERE is_active = true
    ORDER BY event_date DESC, created_at DESC
    LIMIT 1
);
