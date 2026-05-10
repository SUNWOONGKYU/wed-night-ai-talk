-- ========================================
-- "permission denied for table users" 버그 수정
-- 원인: RLS 정책이 EXISTS (SELECT 1 FROM auth.users ...) 사용
--       → authenticated 롤이 auth.users를 SELECT 못해 정책 평가 실패
-- 해결: auth.jwt() ->> 'email' IN (...) 패턴으로 교체 (auth.users 접근 불필요)
-- ========================================

-- ---------- is_admin() 헬퍼 함수 (SECURITY DEFINER) ----------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (auth.jwt() ->> 'email') IN ('wksun999@gmail.com', 'lsonic.lee@gmail.com'),
        FALSE
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ---------- event_slots: admin write 정책 재작성 ----------
DROP POLICY IF EXISTS event_slots_admin_write ON event_slots;
CREATE POLICY event_slots_admin_write ON event_slots
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ---------- inquiries: admin SELECT/UPDATE/DELETE 정책 재작성 ----------
DROP POLICY IF EXISTS inquiries_admin_select ON inquiries;
CREATE POLICY inquiries_admin_select ON inquiries
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS inquiries_admin_update ON inquiries;
CREATE POLICY inquiries_admin_update ON inquiries
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS inquiries_admin_delete ON inquiries;
CREATE POLICY inquiries_admin_delete ON inquiries
    FOR DELETE TO authenticated
    USING (public.is_admin());
