-- =============================================
-- Free Talk 카테고리에 '공부하기' 추가 - 2026-05-21
-- =============================================
-- 6종으로 확장: 일반 / 자랑하기 / 공부하기 / 협력하기 / 질문하기 / 요청하기
-- =============================================

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_category_check;
ALTER TABLE posts ADD CONSTRAINT posts_category_check
    CHECK (category IN ('일반', '자랑하기', '공부하기', '협력하기', '질문하기', '요청하기'));
