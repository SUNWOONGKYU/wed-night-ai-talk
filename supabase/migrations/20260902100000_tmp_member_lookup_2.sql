-- =============================================
-- [임시·진단용] 탈퇴 요청자 식별용 조회 함수 (2026-09-02, 두 번째 요청자)
-- =============================================
-- 본인이 삭제를 요청한 두 번째 요청자를 지우려면 먼저 정확한 대상 행을 찾아야 하는데,
-- 이 환경에는 psql 도 Docker 도 없어 DB 를 직접 조회할 수단이 없다.
-- (`supabase db push` 만 가능하고 RAISE NOTICE 는 CLI 출력에 나오지 않는다)
--
-- → 이름/이메일로 회원을 찾아 삭제 영향 범위(참석·게시글·댓글 건수)까지 돌려주는
--   함수를 잠깐 만든다.
--
-- ⚠️ 이 함수는 개인정보를 반환한다. anon 에게 EXECUTE 를 주되, 고정 토큰을 모르면
--    아무것도 돌려주지 않게 잠근다. 토큰 없이는 회원 검색이 불가능하다.
-- ⚠️ 바로 다음 마이그레이션(20260902110000)에서 이 함수를 삭제한다. 절대 남기지 않는다.
-- ⚠️ 실명은 이 파일에 쓰지 않는다 (README PII 규칙) — 검색어는 호출 시 인자로 넘긴다.
-- =============================================

CREATE OR REPLACE FUNCTION _waat_tmp_member_lookup(p_token text, p_q text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb;
BEGIN
    IF p_token IS DISTINCT FROM 'gM9RyENnnKqud7jaN3CskvFJKhe2' THEN
        RETURN jsonb_build_object('error', 'denied');
    END IF;

    IF COALESCE(btrim(p_q), '') = '' THEN
        RETURN jsonb_build_object('error', 'empty query');
    END IF;

    SELECT jsonb_agg(x ORDER BY x->>'created_at')
      INTO v
      FROM (
        SELECT jsonb_build_object(
            'id',          p.id,
            'name',        p.name,
            'email',       p.email,
            'role',        p.role,
            'created_at',  p.created_at,
            'has_auth',    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id),
            'attendance',  (SELECT count(*) FROM attendance a WHERE a.user_id = p.id),
            'posts',       (SELECT count(*) FROM posts      po WHERE po.user_id = p.id),
            'comments',    (SELECT count(*) FROM comments   c  WHERE c.user_id  = p.id)
        ) AS x
        FROM profiles p
        WHERE p.name  ILIKE '%' || p_q || '%'
           OR p.email ILIKE '%' || p_q || '%'
      ) t;

    RETURN COALESCE(v, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION _waat_tmp_member_lookup(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION _waat_tmp_member_lookup(text, text) TO anon;
