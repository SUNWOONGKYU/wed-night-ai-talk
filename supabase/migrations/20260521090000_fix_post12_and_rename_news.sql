-- =============================================
-- id=12 글 자랑하기로 정정 + '새 소식' → 'AI 새 소식' - 2026-05-21
-- =============================================
-- id=12은 자랑하기로 작성됐으나 캐시 불일치로 '새 소식' 폴백된 글.
-- =============================================

-- 1) id=12 → 자랑하기
UPDATE posts SET category = '자랑하기' WHERE id = 12;

-- 2) '새 소식' → 'AI 새 소식'
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_category_check;
ALTER TABLE posts ADD CONSTRAINT posts_category_check
    CHECK (category IN ('새 소식','AI 새 소식','자랑하기','공부하기','협력하기','질문하기','요청하기','토론하기'));

UPDATE posts SET category = 'AI 새 소식' WHERE category = '새 소식';
ALTER TABLE posts ALTER COLUMN category SET DEFAULT 'AI 새 소식';

ALTER TABLE posts DROP CONSTRAINT posts_category_check;
ALTER TABLE posts ADD CONSTRAINT posts_category_check
    CHECK (category IN ('AI 새 소식','자랑하기','공부하기','협력하기','질문하기','요청하기','토론하기'));

-- 결과
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT title, category FROM posts ORDER BY created_at DESC LIMIT 5 LOOP
        RAISE NOTICE '[결과] %  →  %', r.category, r.title;
    END LOOP;
END $$;
