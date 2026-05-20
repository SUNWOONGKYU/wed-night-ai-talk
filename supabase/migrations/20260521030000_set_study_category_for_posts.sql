-- =============================================
-- 운영 결정: 현재 게시글 목록(최신순) 2번째·4번째를 '공부하기'로 분류 - 2026-05-21
-- =============================================

-- 변경 대상 사전 출력 (어떤 글이 바뀌는지 확인용)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        WITH ordered AS (
            SELECT id, title, category, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
            FROM posts
        )
        SELECT * FROM ordered WHERE rn IN (2, 4)
    LOOP
        RAISE NOTICE '[공부하기 변경] rn=% id=% title=% (현재 category=%)',
            r.rn, r.id, r.title, r.category;
    END LOOP;
END $$;

WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn FROM posts
)
UPDATE posts
SET category = '공부하기'
WHERE id IN (SELECT id FROM ordered WHERE rn IN (2, 4));
