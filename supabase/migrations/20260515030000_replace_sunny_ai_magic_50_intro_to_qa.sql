-- =============================================
-- 모임 description: "SUNNY AI MAGIC 50 소개" → "SUNNY AI MAGIC 50 관련 문답" - 2026-05-15
-- =============================================
-- 운영자 요청: 2~4회차 모임 정보의 정확한 영문 문구 치환
-- =============================================

UPDATE events
SET description = REPLACE(description, 'SUNNY AI MAGIC 50 소개', 'SUNNY AI MAGIC 50 관련 문답')
WHERE description LIKE '%SUNNY AI MAGIC 50 소개%';
