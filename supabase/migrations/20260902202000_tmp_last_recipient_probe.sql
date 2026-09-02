-- [임시·진단용] 마지막 발송의 '실제 수신자'가 profiles 와 매칭되는지 (2026-09-02)
--
-- profiles 데이터는 멀쩡한데(이메일 채워져 있고 토큰도 있음) 발송 시 토큰을 못 찾았다.
-- 그렇다면 실제로 보낸 주소가 내가 가정한 주소와 다를 수 있다.
-- email_logs.recipients 에 남은 실제 주소로 같은 대조를 해 본다.
--
-- ⚠️ 주소 원문은 반환하지 않는다 — 마스킹해서 돌려준다. 토큰으로 잠근다.
-- 20260902210000 에서 삭제한다.

CREATE OR REPLACE FUNCTION _waat_tmp_last_recipient(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row   record;
    v_addr  text;
BEGIN
    IF p_token IS DISTINCT FROM 'ba52ec97-6065-4184-bebf-ba92d293ac55' THEN
        RETURN jsonb_build_object('error', 'denied');
    END IF;

    SELECT l.id, l.subject, l.created_at, l.recipients
      INTO v_row
      FROM email_logs l
     ORDER BY l.created_at DESC
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'no logs');
    END IF;

    -- recipients 는 text[] 또는 jsonb 일 수 있다. 첫 항목만 꺼낸다.
    BEGIN
        v_addr := (v_row.recipients)::jsonb ->> 0;
    EXCEPTION WHEN OTHERS THEN
        v_addr := NULL;
    END;

    IF v_addr IS NULL THEN
        RETURN jsonb_build_object('subject', v_row.subject, 'error', 'recipients 파싱 실패');
    END IF;

    RETURN jsonb_build_object(
        'subject',     v_row.subject,
        'created_at',  v_row.created_at,
        'addr_masked', mask_email(v_addr),
        'addr_raw_is_lowercase', v_addr = lower(v_addr),
        'addr_has_spaces',       v_addr <> btrim(v_addr),
        'exact_match_profiles',  (SELECT count(*) FROM profiles WHERE email = v_addr),
        'ci_match_profiles',     (SELECT count(*) FROM profiles WHERE lower(btrim(email)) = lower(btrim(v_addr))),
        'token_exists',          (SELECT count(*) FROM profiles
                                   WHERE lower(btrim(email)) = lower(btrim(v_addr))
                                     AND unsubscribe_token IS NOT NULL),
        'opted_out',             (SELECT count(*) FROM profiles
                                   WHERE lower(btrim(email)) = lower(btrim(v_addr))
                                     AND email_opt_out)
    );
END;
$$;

REVOKE ALL ON FUNCTION _waat_tmp_last_recipient(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION _waat_tmp_last_recipient(text) TO anon;
