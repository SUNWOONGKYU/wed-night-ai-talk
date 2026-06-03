-- =============================================
-- posts 테이블: 관리자 UPDATE 정책 추가 - 2026-06-03
-- =============================================
-- 기존: 본인 게시글만 UPDATE 가능 (작성자 RLS)
-- 추가: is_admin()=true 인 사용자는 모든 게시글 UPDATE 가능
-- =============================================

DROP POLICY IF EXISTS posts_admin_update ON posts;
CREATE POLICY posts_admin_update ON posts
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 확인용
DO $$
BEGIN
    RAISE NOTICE '[ok] posts_admin_update 정책 생성 완료 (is_admin() 기반)';
END $$;
