-- =============================================
-- 카테고리 '홍보하기' → '자랑하기' 환원 - 2026-05-21
-- =============================================

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_category_check;
ALTER TABLE posts ADD CONSTRAINT posts_category_check
    CHECK (category IN ('새 소식', '홍보하기', '자랑하기', '공부하기', '협력하기', '질문하기', '요청하기', '토론하기'));

UPDATE posts SET category = '자랑하기' WHERE category = '홍보하기';

ALTER TABLE posts DROP CONSTRAINT posts_category_check;
ALTER TABLE posts ADD CONSTRAINT posts_category_check
    CHECK (category IN ('새 소식', '자랑하기', '공부하기', '협력하기', '질문하기', '요청하기', '토론하기'));
