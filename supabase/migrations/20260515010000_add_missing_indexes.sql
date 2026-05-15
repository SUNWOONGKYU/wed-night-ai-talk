-- =============================================
-- 누락된 인덱스 추가 (성능 보완) - 2026-05-15
-- =============================================
-- PostgreSQL은 FOREIGN KEY 컬럼에 자동 인덱스를 생성하지 않는다.
-- speakup 게시판 사용 패턴 분석 결과 다음 쿼리가 자주 발생:
--   - SELECT FROM posts WHERE user_id = ?       (프로필 페이지 — 내 글 목록)
--   - SELECT FROM comments WHERE post_id = ?    (댓글 목록 로드)
--   - SELECT FROM comments WHERE user_id = ?    (내가 단 댓글)
--   - SELECT FROM post_reactions WHERE post_id = ?
--   - SELECT FROM posts ORDER BY created_at DESC (목록 정렬)
-- =============================================

-- posts
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at_desc ON posts(created_at DESC);

-- comments
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);

-- post_reactions
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user_id ON post_reactions(user_id);

-- inquiries (관리자 페이지에서 created_at DESC 조회)
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at_desc ON inquiries(created_at DESC);
