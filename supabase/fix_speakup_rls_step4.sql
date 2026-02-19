-- =============================================
-- STEP 4: 조회수 컬럼 + RPC 함수 추가
-- =============================================

ALTER TABLE posts ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_post_view(p_post_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE posts SET view_count = view_count + 1 WHERE id = p_post_id;
END;
$$;
