-- 2026-05-09: 1차 정기 모임 일자 확정
-- 1차 모임: 2026년 5월 13일 (수요일)
-- 가장 최근 활성 이벤트(현재 표시되는 메인 모임)의 날짜를 2026-05-13으로 못 박는다.

UPDATE events
SET event_date = '2026-05-13',
    day_label = 'WED',
    title = '1차 모임',
    event_times = ''  -- event_times는 더 이상 사용하지 않음 (3 타임은 코드 상수)
WHERE id = (
    SELECT id FROM events
    WHERE is_active = true
    ORDER BY event_date DESC, created_at DESC
    LIMIT 1
);

-- 확인
SELECT id, title, event_date, day_label, location, provision
FROM events
WHERE is_active = true
ORDER BY event_date DESC;
