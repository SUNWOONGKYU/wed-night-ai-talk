-- [임시·진단용] 발송 대상 이메일이 profiles 와 매칭되는지 점검 (2026-09-02)
--
-- 최근 테스트 발송의 body_preview 를 보니 수신거부 푸터가 '링크 없음' 분기로 나갔다.
-- 즉 수신자 이메일로 profiles 행을 못 찾아 unsubscribe_token 을 구하지 못했다는 뜻이다.
-- 왜 못 찾는지(=이메일이 비었는지, 대소문자인지, auth 와 다른지) 확인해야 한다.
--
-- 개인정보는 반환하지 않는다 — 존재 여부와 건수만 돌려준다. 토큰으로 잠근다.
-- 20260902210000 에서 삭제한다.

CREATE OR REPLACE FUNCTION _waat_tmp_email_match(p_token text, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email text := lower(btrim(COALESCE(p_email, '')));
BEGIN
    IF p_token IS DISTINCT FROM 'ba52ec97-6065-4184-bebf-ba92d293ac55' THEN
        RETURN jsonb_build_object('error', 'denied');
    END IF;

    RETURN jsonb_build_object(
        -- 전체 그림: profiles 에 이메일이 비어 있는 회원이 몇 명인가
        'profiles_total',        (SELECT count(*) FROM profiles),
        'profiles_email_null',   (SELECT count(*) FROM profiles WHERE email IS NULL OR btrim(email) = ''),
        'profiles_email_upper',  (SELECT count(*) FROM profiles WHERE email IS NOT NULL AND email <> lower(email)),
        'profiles_no_token',     (SELECT count(*) FROM profiles WHERE unsubscribe_token IS NULL),
        -- auth 에는 이메일이 있는데 profiles 에는 없는 회원 (이 사람들은 링크를 못 받는다)
        'auth_has_profile_null', (
            SELECT count(*) FROM auth.users u JOIN profiles p ON p.id = u.id
             WHERE u.email IS NOT NULL AND btrim(u.email) <> ''
               AND (p.email IS NULL OR btrim(p.email) = '')
        ),
        -- 물어본 주소 한 건에 대한 판정
        'query', jsonb_build_object(
            'exact_match',        (SELECT count(*) FROM profiles WHERE email = v_email),
            'case_insensitive',   (SELECT count(*) FROM profiles WHERE lower(btrim(email)) = v_email),
            'in_auth_users',      (SELECT count(*) FROM auth.users WHERE lower(btrim(email)) = v_email),
            'profile_email_empty_for_that_auth', (
                SELECT count(*) FROM auth.users u JOIN profiles p ON p.id = u.id
                 WHERE lower(btrim(u.email)) = v_email
                   AND (p.email IS NULL OR btrim(p.email) = '')
            )
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION _waat_tmp_email_match(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION _waat_tmp_email_match(text, text) TO anon;
