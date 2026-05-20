-- =============================================
-- 카테고리에 '토론하기' 추가 (7번째) - 2026-05-21
-- =============================================
-- 총 7종: 새 소식 / 공부하기 / 홍보하기 / 협력하기 / 질문하기 / 요청하기 / 토론하기
-- =============================================

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_category_check;
ALTER TABLE posts ADD CONSTRAINT posts_category_check
    CHECK (category IN ('새 소식', '공부하기', '홍보하기', '협력하기', '질문하기', '요청하기', '토론하기'));
