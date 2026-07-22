-- =============================================================
-- 게시글 상단 고정: 관리자만 최대 3개까지 고정할 수 있다.
-- =============================================================

ALTER TABLE public.posts
    ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_posts_pinned_created_at
    ON public.posts (pinned_at DESC NULLS LAST, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_post_pinned(
    p_post_id BIGINT,
    p_pinned BOOLEAN
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pinned_at TIMESTAMPTZ;
    v_pinned_count INTEGER;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'permission denied: admin only'
            USING ERRCODE = '42501';
    END IF;

    -- 모든 고정/해제 요청을 한 줄로 세워 최대 3개 제약을 동시성에도 보장한다.
    PERFORM pg_advisory_xact_lock(73102001);

    SELECT pinned_at
      INTO v_pinned_at
      FROM public.posts
     WHERE id = p_post_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'post not found: %', p_post_id
            USING ERRCODE = 'P0002';
    END IF;

    IF p_pinned AND v_pinned_at IS NULL THEN
        SELECT COUNT(*)
          INTO v_pinned_count
          FROM public.posts
         WHERE pinned_at IS NOT NULL;

        IF v_pinned_count >= 3 THEN
            RAISE EXCEPTION '상단 고정글은 최대 3개까지 설정할 수 있습니다.'
                USING ERRCODE = 'P0001';
        END IF;

        UPDATE public.posts
           SET pinned_at = NOW(),
               updated_at = NOW()
         WHERE id = p_post_id
         RETURNING pinned_at INTO v_pinned_at;
    ELSIF NOT p_pinned AND v_pinned_at IS NOT NULL THEN
        UPDATE public.posts
           SET pinned_at = NULL,
               updated_at = NOW()
         WHERE id = p_post_id
         RETURNING pinned_at INTO v_pinned_at;
    END IF;

    RETURN v_pinned_at;
END;
$$;

REVOKE ALL ON FUNCTION public.set_post_pinned(BIGINT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_post_pinned(BIGINT, BOOLEAN) TO authenticated;

COMMENT ON COLUMN public.posts.pinned_at IS '관리자가 상단 고정한 시각. NULL이 아니면 현재 아젠다 고정글이며 최대 3개.';