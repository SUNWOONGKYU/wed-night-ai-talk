-- [임시·진단용] 최근 발송 메일의 실제 본문 미리보기 조회 (2026-09-02)
--
-- "메일 하단에 수신거부 안내가 안 보인다"(PO)를 원격에서 진단하려면, 실제로 나간
-- HTML 이 어떤 모양인지 봐야 한다. email_logs 는 관리자만 읽을 수 있고 이 환경에는
-- psql·Docker 가 없어 직접 조회할 수단이 없다.
--
-- → 토큰으로 잠근 조회 함수를 잠깐 만든다.
--    수신자 목록(recipients)·상세(details)는 반환하지 않는다 — 개인정보다.
--    subject / body_preview / 시각 / 상태만 돌려준다.
-- → 진단이 끝나면 20260902210000 에서 삭제한다. 절대 남기지 않는다.

CREATE OR REPLACE FUNCTION _waat_tmp_email_preview(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v jsonb;
BEGIN
    IF p_token IS DISTINCT FROM 'ba52ec97-6065-4184-bebf-ba92d293ac55' THEN
        RETURN jsonb_build_object('error', 'denied');
    END IF;

    SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC)
      INTO v
      FROM (
        SELECT jsonb_build_object(
            'id',           l.id,
            'subject',      l.subject,
            'created_at',   l.created_at,
            'status',       l.status,
            'recipients_count', l.recipients_count,
            'success_count',    l.success_count,
            'body_preview', l.body_preview
        ) AS x
        FROM email_logs l
        ORDER BY l.created_at DESC
        LIMIT 3
      ) t;

    RETURN COALESCE(v, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION _waat_tmp_email_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION _waat_tmp_email_preview(text) TO anon;
