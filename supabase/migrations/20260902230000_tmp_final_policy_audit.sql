-- [임시·진단용] 최종 정책 감사 (2026-09-02)
--
-- 익명(anon) 관점은 REST 로 테이블 전수 실측을 마쳤다. 남은 것은 '로그인 회원'
-- 관점 — 가입만 하면 볼 수 있는 것이 더 있는지다. 로그인 자격증명이 없어
-- 실호출로는 확인할 수 없으므로, 정책·권한 메타데이터로 확인한다.
--
-- 회원 데이터는 반환하지 않는다. 20260902240000 에서 삭제한다.

CREATE OR REPLACE FUNCTION _waat_tmp_audit(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF p_token IS DISTINCT FROM 'ba52ec97-6065-4184-bebf-ba92d293ac55' THEN
        RETURN jsonb_build_object('error', 'denied');
    END IF;

    RETURN jsonb_build_object(
        -- 1) RLS 가 꺼진 테이블 (있으면 정책과 무관하게 통째로 열린다)
        'rls_disabled', (
            SELECT COALESCE(jsonb_agg(c.relname ORDER BY c.relname), '[]'::jsonb)
              FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
        ),
        -- 2) 전체공개 SELECT 정책 (USING true 또는 조건 없음)
        'open_select_policies', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       'table', tablename, 'policy', policyname, 'roles', roles::text)
                       ORDER BY tablename), '[]'::jsonb)
              FROM pg_policies
             WHERE schemaname = 'public' AND cmd IN ('SELECT', 'ALL')
               AND (qual IS NULL OR btrim(qual) = 'true')
        ),
        -- 3) authenticated 가 SELECT 할 수 있는 테이블·컬럼 수
        'authenticated_readable', (
            SELECT COALESCE(jsonb_object_agg(table_name, cnt), '{}'::jsonb)
              FROM (SELECT table_name, count(*) AS cnt
                      FROM information_schema.column_privileges
                     WHERE table_schema = 'public' AND grantee = 'authenticated'
                       AND privilege_type = 'SELECT'
                     GROUP BY table_name) t
        ),
        -- 4) anon 이 SELECT 할 수 있는 테이블·컬럼 수
        'anon_readable', (
            SELECT COALESCE(jsonb_object_agg(table_name, cnt), '{}'::jsonb)
              FROM (SELECT table_name, count(*) AS cnt
                      FROM information_schema.column_privileges
                     WHERE table_schema = 'public' AND grantee = 'anon'
                       AND privilege_type = 'SELECT'
                     GROUP BY table_name) t
        ),
        -- 5) anon 이 실행할 수 있는 함수 (의도한 것만 있어야 한다)
        'anon_executable_functions', (
            SELECT COALESCE(jsonb_agg(p.proname ORDER BY p.proname), '[]'::jsonb)
              FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.prokind = 'f'
               AND has_function_privilege('anon', p.oid, 'EXECUTE')
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION _waat_tmp_audit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION _waat_tmp_audit(text) TO anon;
