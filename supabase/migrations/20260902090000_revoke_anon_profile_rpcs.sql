-- =============================================
-- 프로필 RPC 3종 — anon EXECUTE 회수 (2026-09-02)
-- =============================================
-- 20260902080000 에서 `REVOKE ALL ... FROM PUBLIC` + `GRANT ... TO authenticated`
-- 로 잠갔다고 보았는데, 실측해 보니 anon 이 여전히 실행할 수 있었다.
-- Supabase 는 public 스키마에 만들어지는 함수에 대해 기본 권한(default privileges)
-- 으로 anon 에게 EXECUTE 를 직접 부여한다. PUBLIC 회수로는 그 직접 부여분이 지워지지
-- 않는다 — 역할을 지정해 따로 회수해야 한다.
--
-- 실제 유출은 없었다. get_my_profile() 은 auth.uid() 가 없으면 NULL 을,
-- admin_* 은 is_admin() 가드에 걸려 42501 을 돌려준다.
-- 그래도 "권한이 없어야 할 역할에 권한이 남아 있는" 상태이므로 정리한다.
-- =============================================

REVOKE EXECUTE ON FUNCTION get_my_profile()            FROM anon;
REVOKE EXECUTE ON FUNCTION admin_list_profiles()       FROM anon;
REVOKE EXECUTE ON FUNCTION admin_get_profiles(uuid[])  FROM anon;

-- 검증 — anon 에게 EXECUTE 가 남아 있으면 롤백한다.
DO $$
DECLARE
    leftover text;
BEGIN
    SELECT string_agg(p.proname, ', ')
      INTO leftover
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('get_my_profile', 'admin_list_profiles', 'admin_get_profiles')
       AND has_function_privilege('anon', p.oid, 'EXECUTE');

    IF leftover IS NOT NULL THEN
        RAISE EXCEPTION '[검증실패] anon 이 아직 실행할 수 있다: %', leftover;
    END IF;

    -- authenticated 는 반드시 실행할 수 있어야 한다 (여기서 막히면 로그인 화면이 깨진다)
    SELECT string_agg(p.proname, ', ')
      INTO leftover
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('get_my_profile', 'admin_list_profiles', 'admin_get_profiles')
       AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE');

    IF leftover IS NOT NULL THEN
        RAISE EXCEPTION '[검증실패] authenticated 가 실행하지 못한다: %', leftover;
    END IF;

    RAISE NOTICE '[ok] anon 회수 / authenticated 유지 확인';
END
$$;
