-- =============================================
-- 이메일 수신거부 기능 (PO 승인, 2026-09-02)
-- =============================================
-- 배경 — 발송 대상을 profiles 전체에서 뽑는데 수신거부 수단이 없었다. 그래서
-- "메일 그만 보내달라"는 요청에 탈퇴 처리 말고는 방법이 없었다(오늘 2건 발생).
--
-- PO 결정
--   · 메일 하단 자가 수신거부 링크 + 관리자 수동 토글 둘 다
--   · 수신거부해도 회원은 유지한다 — 모임 신청·게시판은 그대로 쓰고 메일만 끊는다
--
-- ⚠️ unsubscribe_token 은 클라이언트에 절대 내보내지 않는다.
--    profiles 컬럼 권한이 (id, name) 뿐이라 테이블 직접조회로는 못 읽고,
--    아래 RPC 들도 반환에서 이 컬럼을 제거한다.
--    링크는 Edge Function(service role)이 메일을 만들 때만 붙인다.
-- =============================================

-- ---------------------------------------------------------------------------
-- 1) 컬럼 추가
--    unsubscribe_token 의 DEFAULT 는 volatile 이라 기존 행에도 각각 다른 값이 채워진다.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS email_opt_out     boolean     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS email_opt_out_at  timestamptz,
    ADD COLUMN IF NOT EXISTS unsubscribe_token uuid        NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_unsubscribe_token_key
    ON public.profiles (unsubscribe_token);

-- 새 컬럼에 anon·authenticated 권한이 붙지 않았는지 확인한다.
-- (ALTER TABLE ADD COLUMN 은 기존 컬럼 단위 grant 를 새 컬럼에 물려주지 않는다)
DO $$
DECLARE
    leaked text;
BEGIN
    SELECT string_agg(grantee || '.' || column_name, ', ')
      INTO leaked
      FROM information_schema.column_privileges
     WHERE table_schema = 'public' AND table_name = 'profiles'
       AND privilege_type = 'SELECT'
       AND grantee IN ('anon', 'authenticated')
       AND column_name IN ('unsubscribe_token', 'email_opt_out', 'email_opt_out_at');
    IF leaked IS NOT NULL THEN
        RAISE EXCEPTION '[검증실패] 새 컬럼이 클라이언트에 열려 있다: %', leaked;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) 이메일 마스킹 헬퍼
--    수신거부 링크가 유출됐을 때 제3자에게 주소 전체를 보여주지 않기 위해,
--    확인 화면에는 마스킹된 주소만 내보낸다.  someone@example.com → so*****@example.com
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mask_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_email IS NULL OR position('@' in p_email) = 0 THEN ''
        ELSE (
            CASE WHEN length(split_part(p_email, '@', 1)) <= 2
                 THEN left(split_part(p_email, '@', 1), 1) || '*'
                 ELSE left(split_part(p_email, '@', 1), 2)
                      || repeat('*', greatest(length(split_part(p_email, '@', 1)) - 2, 1))
            END
        ) || '@' || split_part(p_email, '@', 2)
    END;
$$;

-- ---------------------------------------------------------------------------
-- 3) 토큰으로 수신거부 — 메일 하단 링크가 부르는 함수
--    비로그인 상태에서 눌리므로 anon 에게 EXECUTE 를 준다.
--    토큰을 모르면 아무것도 못 한다. 토큰이 틀리면 이유를 알려주지 않는다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION unsubscribe_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row profiles%ROWTYPE;
    v_already boolean;
BEGIN
    IF p_token IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
    END IF;

    SELECT * INTO v_row FROM profiles WHERE unsubscribe_token = p_token;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
    END IF;

    v_already := v_row.email_opt_out;

    IF NOT v_already THEN
        UPDATE profiles
           SET email_opt_out = true,
               email_opt_out_at = now()
         WHERE id = v_row.id;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'already', v_already,
        'name', COALESCE(v_row.name, ''),
        'email_masked', mask_email(v_row.email)
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) 토큰으로 재구독 — 잘못 눌렀을 때 되돌린다 (같은 페이지의 버튼)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION resubscribe_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row profiles%ROWTYPE;
BEGIN
    IF p_token IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
    END IF;

    SELECT * INTO v_row FROM profiles WHERE unsubscribe_token = p_token;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
    END IF;

    UPDATE profiles
       SET email_opt_out = false,
           email_opt_out_at = NULL
     WHERE id = v_row.id;

    RETURN jsonb_build_object(
        'ok', true,
        'name', COALESCE(v_row.name, ''),
        'email_masked', mask_email(v_row.email)
    );
END;
$$;

REVOKE ALL ON FUNCTION unsubscribe_by_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION resubscribe_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION unsubscribe_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION resubscribe_by_token(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) 관리자 수동 토글
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_set_email_opt_out(p_id uuid, p_value boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION '관리자만 변경할 수 있습니다' USING ERRCODE = '42501';
    END IF;

    UPDATE profiles
       SET email_opt_out = COALESCE(p_value, false),
           email_opt_out_at = CASE WHEN COALESCE(p_value, false) THEN now() ELSE NULL END
     WHERE id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '해당 회원을 찾을 수 없습니다' USING ERRCODE = 'P0002';
    END IF;

    RETURN jsonb_build_object('ok', true, 'id', p_id, 'email_opt_out', COALESCE(p_value, false));
END;
$$;

REVOKE ALL ON FUNCTION admin_set_email_opt_out(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_set_email_opt_out(uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) 기존 프로필 RPC 3종 — 반환에서 unsubscribe_token 을 제거한다.
--    관리자 화면도 토큰을 알 필요가 없다(링크는 서버가 만든다).
--    email_opt_out 은 관리자 화면 표시에 필요하므로 남긴다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT to_jsonb(p) - 'unsubscribe_token' FROM profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION admin_list_profiles()
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
        (SELECT jsonb_agg((to_jsonb(p) - 'unsubscribe_token') ORDER BY p.created_at DESC)
           FROM profiles p),
        '[]'::jsonb
    );
END;
$$;

CREATE OR REPLACE FUNCTION admin_get_profiles(p_ids uuid[])
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

    IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    RETURN COALESCE(
        (SELECT jsonb_agg(to_jsonb(p) - 'unsubscribe_token')
           FROM profiles p WHERE p.id = ANY(p_ids)),
        '[]'::jsonb
    );
END;
$$;

-- CREATE OR REPLACE 는 기존 권한을 유지하지만, 20260902090000 에서 회수한 anon
-- EXECUTE 가 정말 유지되는지 아래 검증에서 다시 확인한다.

-- ---------------------------------------------------------------------------
-- 7) 검증 — 실패하면 전체 롤백
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
    v_token uuid;
    v_id    uuid;
    v_res   jsonb;
    leftover text;
BEGIN
    -- 7-1) anon 이 프로필 RPC 를 실행할 수 없어야 한다 (CREATE OR REPLACE 후 재확인)
    SELECT string_agg(p.proname, ', ')
      INTO leftover
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('get_my_profile', 'admin_list_profiles', 'admin_get_profiles')
       AND has_function_privilege('anon', p.oid, 'EXECUTE');
    IF leftover IS NOT NULL THEN
        RAISE EXCEPTION '[검증실패] anon 이 프로필 RPC 를 실행할 수 있다: %', leftover;
    END IF;

    -- 7-2) 토큰이 회원마다 서로 다른가 (기본값이 한 번만 평가돼 전원 동일하면 대형사고)
    IF (SELECT count(DISTINCT unsubscribe_token) FROM profiles)
       <> (SELECT count(*) FROM profiles) THEN
        RAISE EXCEPTION '[검증실패] unsubscribe_token 이 중복된다';
    END IF;

    -- 7-3) 수신거부 → 재구독 왕복이 실제로 동작하는가 (아무 회원 1명으로 시험 후 원복)
    SELECT id, unsubscribe_token INTO v_id, v_token
      FROM profiles WHERE email_opt_out = false LIMIT 1;

    IF v_id IS NOT NULL THEN
        v_res := unsubscribe_by_token(v_token);
        IF NOT (v_res->>'ok')::boolean THEN
            RAISE EXCEPTION '[검증실패] unsubscribe_by_token 이 실패했다: %', v_res;
        END IF;
        IF NOT (SELECT email_opt_out FROM profiles WHERE id = v_id) THEN
            RAISE EXCEPTION '[검증실패] 수신거부 플래그가 설정되지 않았다';
        END IF;

        v_res := resubscribe_by_token(v_token);
        IF NOT (v_res->>'ok')::boolean THEN
            RAISE EXCEPTION '[검증실패] resubscribe_by_token 이 실패했다: %', v_res;
        END IF;
        IF (SELECT email_opt_out FROM profiles WHERE id = v_id) THEN
            RAISE EXCEPTION '[검증실패] 재구독이 원복되지 않았다';
        END IF;
    END IF;

    -- 7-4) 없는 토큰은 조용히 거절되는가
    v_res := unsubscribe_by_token('00000000-0000-0000-0000-000000000000'::uuid);
    IF (v_res->>'ok')::boolean THEN
        RAISE EXCEPTION '[검증실패] 없는 토큰이 수락됐다';
    END IF;

    -- 7-5) 마스킹
    IF mask_email('someone@example.com') <> 'so*****@example.com' THEN
        RAISE EXCEPTION '[검증실패] mask_email 결과가 예상과 다르다: %', mask_email('someone@example.com');
    END IF;

    RAISE NOTICE '[ok] 수신거부 기능 검증 통과';
END
$verify$;
