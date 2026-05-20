-- =============================================
-- 카테고리 '자랑하기' → '홍보하기' + 4번째 글 분류 - 2026-05-21
-- =============================================

-- 1) 두 값 임시 허용
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_category_check;
ALTER TABLE posts ADD CONSTRAINT posts_category_check
    CHECK (category IN ('새 소식', '자랑하기', '홍보하기', '공부하기', '협력하기', '질문하기', '요청하기'));

-- 2) 기존 '자랑하기' → '홍보하기'
UPDATE posts SET category = '홍보하기' WHERE category = '자랑하기';

-- 3) CHECK 최종화 — 자랑하기 제거
ALTER TABLE posts DROP CONSTRAINT posts_category_check;
ALTER TABLE posts ADD CONSTRAINT posts_category_check
    CHECK (category IN ('새 소식', '홍보하기', '공부하기', '협력하기', '질문하기', '요청하기'));

-- 4) 4번째(최신순) 글을 '홍보하기'로 설정
WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn FROM posts
)
UPDATE posts SET category = '홍보하기'
WHERE id IN (SELECT id FROM ordered WHERE rn = 4);

-- 결과 확인
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT title, category FROM posts ORDER BY created_at DESC LIMIT 4 LOOP
        RAISE NOTICE '[결과] %  →  %', r.category, r.title;
    END LOOP;
END $$;
