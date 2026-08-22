-- =============================================
-- 비로그인 조회수 집계 허용 (PO, 2026-08-22)
--
-- 2026-05-14 보안 강화(20260514030000_security_hardening.sql)에서 조회수 조작 방지를
-- 위해 로그인 사용자만 집계하도록 막았다. 그 결과 AI Biz Daily 게시판에 하루 290명대
-- 이메일을 보내도 조회수가 1~30대에 머무는 문제가 드러났다 -- 이메일 클릭 유입은
-- 거의 전부 비로그인이라 애초에 집계 자체가 안 되고 있었다.
--
-- 이번 변경: 클라이언트가 localStorage에 발급해 보관하는 랜덤 UUID(방문자 키)를
-- p_anon_key로 같이 보내, 로그인 사용자는 기존처럼 auth.uid()로, 비로그인은 그 키로
-- post_views(post_id, viewer_id) UNIQUE 중복 방지를 그대로 재사용한다.
--
-- 한계(정직하게 기록): auth.uid()와 달리 p_anon_key는 서버가 검증할 수 없는 클라이언트
-- 자기 신고 값이다 -- localStorage를 지우거나 매 호출마다 새 UUID를 보내는 스크립트를
-- 쓰면 여전히 조회수를 부풀릴 수 있다. 로그인 방식만큼의 방어력은 아니며, "누구나 아무
-- 글이나 무제한 증가"였던 원래 취약점보다는 낫다는 정도의 개선이다.
-- =============================================

DROP FUNCTION IF EXISTS increment_post_view(INTEGER);

CREATE OR REPLACE FUNCTION increment_post_view(p_post_id INTEGER, p_anon_key UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := COALESCE(auth.uid(), p_anon_key);
    v_inserted BOOLEAN := FALSE;
BEGIN
    -- 로그인 사용자는 auth.uid() 우선, 비로그인은 클라이언트가 보낸 방문자 키만 인정한다.
    -- 둘 다 없으면(구버전 클라이언트 등) 조용히 무시한다.
    IF v_uid IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO post_views (post_id, viewer_id)
    VALUES (p_post_id, v_uid)
    ON CONFLICT (post_id, viewer_id) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    IF v_inserted THEN
        UPDATE posts SET view_count = view_count + 1 WHERE id = p_post_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION increment_post_view(INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_post_view(INTEGER, UUID) TO authenticated, anon;
