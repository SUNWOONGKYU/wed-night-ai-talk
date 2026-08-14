-- Allow the dedicated AI Biz Daily board to persist posts.
ALTER TABLE public.posts
    DROP CONSTRAINT IF EXISTS posts_category_check;

ALTER TABLE public.posts
    ADD CONSTRAINT posts_category_check
    CHECK (category IN (
        'AI 새 소식',
        'AI Biz Daily',
        '자랑하기',
        '공부하기',
        '협력하기',
        '질문하기',
        '요청하기',
        '토론하기'
    ));
