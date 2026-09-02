-- =============================================
-- 관리자 판별 단일화 — profiles.role = 'admin' 하나로 (PO 지시, 2026-09-02)
-- =============================================
-- 지금까지 관리자 목록이 세 군데에 따로 박혀 있었다.
--   ① js/supabase-config.js  ADMIN_EMAILS 배열
--   ② supabase/functions/send-email/index.ts  같은 배열 재선언
--   ③ is_admin() 함수 본문의 JWT 이메일 비교
-- 관리자를 바꾸려면 세 곳을 다 고쳐야 하고, 하나라도 빠뜨리면 조용히 어긋난다.
-- 게다가 클라이언트 화면 일부(main.js, profile.js)는 이미 profiles.role 로 판별하고
-- 있어서, 같은 시스템 안에 판별 기준이 두 개 공존했다.
--
-- → profiles.role = 'admin' 을 유일한 출처로 삼는다. 이 파일의 부트스트랩 목록이
--   이메일을 코드에 적는 마지막 자리이고, 이후로는 DB 값만 바꾸면 된다.
--
-- ⚠️ is_admin() 은 SECURITY DEFINER 라 함수 안에서는 컬럼 권한이 적용되지 않는다.
--    그래서 profiles.role 을 읽어도 안전하다.
--    반대로 RLS 정책에 `EXISTS (SELECT ... profiles.role ...)` 를 직접 인라인하면
--    컬럼 권한 회수와 충돌해 조회가 통째로 막힌다 — 2026-09-02 에 실측으로 확인했고
--    그래서 정책 8개를 전부 is_admin() 호출로 바꿔 두었다. 그 구조를 유지한다.
-- =============================================

-- ---------------------------------------------------------------------------
-- 1) 부트스트랩 — 기존 JWT 목록에 있던 계정에 role='admin' 을 보장한다
--    (이미 admin 인 계정은 그대로. 아무도 강등하지 않는다)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    bootstrap_emails text[] := ARRAY['wksun999@gmail.com', 'lsonic.lee@gmail.com'];
    n_before integer;
    n_after  integer;
    missing  text;
BEGIN
    SELECT count(*) INTO n_before FROM profiles WHERE role = 'admin';

    UPDATE profiles p
       SET role = 'admin'
      FROM auth.users u
     WHERE u.id = p.id
       AND lower(u.email) = ANY (bootstrap_emails)
       AND p.role IS DISTINCT FROM 'admin';

    SELECT count(*) INTO n_after FROM profiles WHERE role = 'admin';

    -- 부트스트랩 목록 중 계정을 못 찾은 것이 있으면 알려준다(치명적이진 않다 —
    -- 아직 가입하지 않았을 수 있다). 다만 전원 실패면 아래 2)에서 막힌다.
    SELECT string_agg(e, ', ') INTO missing
      FROM unnest(bootstrap_emails) e
     WHERE NOT EXISTS (
         SELECT 1 FROM auth.users u JOIN profiles p ON p.id = u.id
          WHERE lower(u.email) = e AND p.role = 'admin'
     );

    RAISE NOTICE '[info] 관리자 %명 → %명. 미해결 부트스트랩 계정: %',
                 n_before, n_after, COALESCE(missing, '없음');
END $$;

-- ---------------------------------------------------------------------------
-- 2) 안전장치 — 관리자가 0명이면 여기서 멈춘다
--    이 상태로 is_admin() 을 role 기반으로 바꾸면 아무도 관리자 페이지에 못 들어간다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    n integer;
BEGIN
    SELECT count(*) INTO n FROM profiles WHERE role = 'admin';
    IF n = 0 THEN
        RAISE EXCEPTION '[중단] role=admin 인 계정이 0명이다 — 판별식을 바꾸면 관리자 접근이 막힌다';
    END IF;
    RAISE NOTICE '[ok] 관리자 %명 확보', n;
END $$;

-- ---------------------------------------------------------------------------
-- 3) is_admin() 을 role 기반으로 교체
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
         WHERE id = auth.uid()
           AND role = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) 관리자 목록 조회 RPC — 화면에서 "누가 관리자인지" 확인할 때 쓴다.
--    (관리자 본인만 볼 수 있다)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_list_admins()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION '관리자만 조회할 수 있습니다' USING ERRCODE = '42501';
    END IF;
    RETURN COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'email', p.email)
                          ORDER BY p.created_at)
           FROM profiles p WHERE p.role = 'admin'),
        '[]'::jsonb
    );
END;
$$;

REVOKE ALL ON FUNCTION admin_list_admins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_admins() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) 검증 — 실패하면 전체 롤백
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
    admin_ids uuid[];
    v_id      uuid;
    leftover  text;
BEGIN
    SELECT array_agg(id) INTO admin_ids FROM profiles WHERE role = 'admin';
    IF admin_ids IS NULL OR array_length(admin_ids, 1) = 0 THEN
        RAISE EXCEPTION '[검증실패] 관리자가 0명이다';
    END IF;

    -- 5-1) is_admin() 이 auth.uid() 에 따라 갈리는지 — 실제 관리자 id 로 흉내 내 본다.
    --      request.jwt.claims 를 세팅하면 auth.uid() 가 그 값을 읽는다.
    v_id := admin_ids[1];
    PERFORM set_config('request.jwt.claims',
                       json_build_object('sub', v_id::text)::text, true);
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION '[검증실패] 관리자 계정인데 is_admin() 이 false 다';
    END IF;

    -- 5-2) 비관리자에게는 false 여야 한다
    SELECT id INTO v_id FROM profiles WHERE role IS DISTINCT FROM 'admin' LIMIT 1;
    IF v_id IS NOT NULL THEN
        PERFORM set_config('request.jwt.claims',
                           json_build_object('sub', v_id::text)::text, true);
        IF public.is_admin() THEN
            RAISE EXCEPTION '[검증실패] 일반 회원인데 is_admin() 이 true 다';
        END IF;
    END IF;

    -- 5-3) 로그인 안 한 상태(claims 없음)에서는 false
    PERFORM set_config('request.jwt.claims', '', true);
    IF public.is_admin() THEN
        RAISE EXCEPTION '[검증실패] 비로그인인데 is_admin() 이 true 다';
    END IF;

    -- 5-4) 관리자 정책이 여전히 is_admin() 을 쓰고 profiles.role 을 직접 인라인하지 않는지
    SELECT string_agg(tablename || '.' || policyname, ', ')
      INTO leftover
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%profiles%'
       AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%role%';
    IF leftover IS NOT NULL THEN
        RAISE EXCEPTION '[검증실패] profiles.role 을 직접 참조하는 정책이 생겼다: %', leftover;
    END IF;

    RAISE NOTICE '[ok] is_admin() role 기반 전환 검증 통과 (관리자 %명)',
                 array_length(admin_ids, 1);
END
$verify$;
