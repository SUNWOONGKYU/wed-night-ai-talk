-- 2026-05-09: 모임 시간 표시 — 단일 시간 → 3 타임 지원
-- event_time(TIME) 단일 컬럼은 그대로 유지 (호환성), 추가로 event_times(TEXT)에 다중 타임 저장
-- 형식: 콤마 구분 "13:00,16:00,19:00" 또는 자유 텍스트 "오후 1시 / 오후 4시 / 오후 7시"

ALTER TABLE events ADD COLUMN IF NOT EXISTS event_times TEXT DEFAULT '';

-- 기존 event_time 값을 event_times로 백필 (값이 있고 event_times가 비어있는 경우만)
UPDATE events
SET event_times = TO_CHAR(event_time, 'HH24:MI')
WHERE event_time IS NOT NULL
  AND (event_times IS NULL OR event_times = '');
