-- 모임 정원(capacity) 컬럼 추가 — 선착순 N명 표시용
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 20;

-- 기존 모든 모임에 20명 디폴트 적용
UPDATE events SET capacity = 20 WHERE capacity IS NULL;
