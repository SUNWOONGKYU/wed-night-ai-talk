-- =============================================
-- [임시·진단용] RLS 정책/권한 조회 함수 (2026-09-02)
-- =============================================
-- profiles 가 익명에게 298행 전부(이름·이메일·전화) 열려 있는 것을 확인했는데,
-- 그 정책이 저장소 마이그레이션 어디에도 없다 — 대시보드에서 직접 만든 뒤
-- 저장소에 반영하지 않은 드리프트다. 정책을 고치려면 현재 무엇이 걸려 있는지
-- 정확히 알아야 하는데, 이 환경에는 Docker 가 없어 `supabase db dump` 가 실패한다.
--
-- → 정책 '메타데이터만' 반환하는 조회 함수를 잠깐 만든다. 회원 데이터는 반환하지 않는다.
-- → 바로 다음 마이그레이션(20260902030000)에서 이 함수를 삭제한다. 절대 남기지 않는다.
-- =============================================

CREATE OR REPLACE FUNCTION _waat_tmp_introspect()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
SELECT jsonb_build_object(
    'policies', (
        SELECT jsonb_agg(jsonb_build_object(
            'table', tablename, 'name', policyname, 'cmd', cmd,
            'permissive', permissive, 'roles', roles, 'qual', qual
        ) ORDER BY tablename, cmd)
        FROM pg_policies WHERE schemaname = 'public'
    ),
    'rls_disabled_tables', (
        SELECT jsonb_agg(c.relname ORDER BY c.relname)
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
    ),
    'profiles_col_grants', (
        SELECT jsonb_agg(jsonb_build_object('grantee', grantee, 'col', column_name))
        FROM information_schema.column_privileges
        WHERE table_schema = 'public' AND table_name = 'profiles'
          AND grantee IN ('anon', 'authenticated') AND privilege_type = 'SELECT'
    )
);
$$;

GRANT EXECUTE ON FUNCTION _waat_tmp_introspect() TO anon;
