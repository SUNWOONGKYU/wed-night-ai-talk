-- =============================================
-- Free Talk 카테고리 컬럼 추가 - 2026-05-21
-- =============================================
-- 카테고리 5종: 일반(기본) / 자랑하기 / 협력하기 / 질문하기 / 요청하기
-- hero 카피("궁금한 것을 묻고, 만든 것을 자랑하고, 협력할 거리를 찾고…")와
-- 1:1 매핑되는 행동 카테고리. '일반'은 잡담·인사·후기용.
-- =============================================

ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '일반';

-- 5개 값만 허용. 추후 카테고리 추가 시 이 제약을 갱신.
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_category_check;
ALTER TABLE posts ADD CONSTRAINT posts_category_check
    CHECK (category IN ('일반', '자랑하기', '협력하기', '질문하기', '요청하기'));

-- 카테고리별 목록 조회 성능
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);

COMMENT ON COLUMN posts.category IS 'Free Talk 카테고리: 일반/자랑하기/협력하기/질문하기/요청하기';
