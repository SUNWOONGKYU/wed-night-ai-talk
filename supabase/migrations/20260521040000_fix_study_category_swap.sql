-- =============================================
-- 공부하기 카테고리 재배정 (이전 마이그레이션 반대로 됐음) - 2026-05-21
-- =============================================
-- 1번째·3번째 → 공부하기, 2번째·4번째 → 일반
-- =============================================

WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn FROM posts
)
UPDATE posts SET category = CASE
    WHEN id IN (SELECT id FROM ordered WHERE rn IN (1, 3)) THEN '공부하기'
    WHEN id IN (SELECT id FROM ordered WHERE rn IN (2, 4)) THEN '일반'
    ELSE category
END
WHERE id IN (SELECT id FROM ordered WHERE rn IN (1, 2, 3, 4));

-- 결과 출력
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT title, category FROM posts
        ORDER BY created_at DESC LIMIT 4
    LOOP
        RAISE NOTICE '[결과] %  →  %', r.category, r.title;
    END LOOP;
END $$;
