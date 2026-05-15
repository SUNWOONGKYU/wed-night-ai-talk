-- =============================================
-- 모임 description: 실제 DB 값 "Sunny의 AI Magic 50 소개" → "Sunny의 AI Magic 50 관련 문답"
-- =============================================
-- 화면에는 CSS text-transform: uppercase 로 인해 대문자로 보이지만
-- DB 실제 값은 mixed case. 정확한 패턴으로 치환.
-- =============================================

UPDATE events
SET description = REPLACE(description, 'Sunny의 AI Magic 50 소개', 'Sunny의 AI Magic 50 관련 문답')
WHERE description LIKE '%Sunny의 AI Magic 50 소개%';
