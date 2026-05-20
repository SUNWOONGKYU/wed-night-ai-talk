-- =============================================
-- 카테고리 '일반' → '새 소식' 이름 변경 - 2026-05-21
-- =============================================

-- 1) 두 값 임시 동시 허용 (전환 윈도)
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_category_check;
ALTER TABLE posts ADD CONSTRAINT posts_category_check
    CHECK (category IN ('일반', '새 소식', '자랑하기', '공부하기', '협력하기', '질문하기', '요청하기'));

-- 2) 기존 '일반' → '새 소식'
UPDATE posts SET category = '새 소식' WHERE category = '일반';

-- 3) DEFAULT 변경
ALTER TABLE posts ALTER COLUMN category SET DEFAULT '새 소식';

-- 4) CHECK 최종화 — '일반' 제거
ALTER TABLE posts DROP CONSTRAINT posts_category_check;
ALTER TABLE posts ADD CONSTRAINT posts_category_check
    CHECK (category IN ('새 소식', '자랑하기', '공부하기', '협력하기', '질문하기', '요청하기'));
