-- =============================================
-- 모임 description의 "써니의 AI 매직 50 소개" → "써니의 AI 매직 50 문답" - 2026-05-15
-- =============================================
-- 운영자 요청: 2~4회차 모임 정보 안의 "매직 50 소개" 문구를 "매직 50 문답"으로 변경
-- 안전: "매직 50" / "매직50" 이 포함된 행에만 적용
-- =============================================

UPDATE events
SET description = REPLACE(description, '매직 50 소개', '매직 50 문답')
WHERE description LIKE '%매직 50 소개%';

UPDATE events
SET description = REPLACE(description, '매직50 소개', '매직50 문답')
WHERE description LIKE '%매직50 소개%';

UPDATE events
SET description = REPLACE(description, 'AI 매직 소개', 'AI 매직 문답')
WHERE description LIKE '%AI 매직 소개%';
