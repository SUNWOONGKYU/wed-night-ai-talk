-- =============================================
-- post_views 익명·회원 조회 차단 (2026-09-02)
-- =============================================
-- 실측: GET /rest/v1/post_views?select=* → 206, 1197행이 익명에게 그대로 열려 있었다.
--   반환 항목: post_id · viewer_id(회원 UUID 또는 비로그인 방문자 키) · viewed_at
--   게시판 글쓴이 이름 표시를 위해 열어둔 profiles(id, name) 과 조인하면
--   "누가 어떤 글을 언제 읽었는지" 전체 열람 이력이 복원된다.
--
-- 원인은 드리프트가 아니라 저장소에 있던 정책이다.
--   20260514030000_security_hardening.sql
--     CREATE POLICY "post_views readable by all" ON post_views FOR SELECT USING (true);
--   조회수 중복 방지용 내부 테이블인데 습관적으로 열어 둔 것으로 보인다.
--
-- 클라이언트는 이 테이블을 읽지 않는다 (js 전수 확인).
--   화면의 조회수는 posts.view_count 컬럼에서 온다 — speakup.js:590, main.js:1446.
--   기록은 increment_post_view() 가 하는데 SECURITY DEFINER 라 RLS·권한과 무관하다.
-- → 조회 권한을 완전히 회수해도 조회수 기능은 그대로 동작한다.
-- =============================================

DROP POLICY IF EXISTS "post_views readable by all" ON public.post_views;

REVOKE SELECT ON public.post_views FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 검증 — 실패하면 롤백
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
    orig      text := current_user;
    err       text := '';
    dummy     int;
    v_post    int;
    v_before  int;
    v_after   int;
    leftover  text;
BEGIN
    -- 1) USING(true) SELECT 정책이 남아 있으면 안 된다
    SELECT string_agg(policyname, ', ') INTO leftover
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'post_views'
       AND cmd IN ('SELECT', 'ALL')
       AND (qual IS NULL OR btrim(qual) = 'true');
    IF leftover IS NOT NULL THEN
        RAISE EXCEPTION '[검증실패] post_views 에 전체공개 SELECT 정책이 남아 있다: %', leftover;
    END IF;

    -- 2) anon / authenticated 로 실제 조회를 시도해 막히는지 본다
    SET LOCAL ROLE anon;
    BEGIN
        SELECT count(*) INTO dummy FROM post_views;
        err := err || ' / anon 이 아직 post_views 를 읽는다';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;   -- 기대한 결과
    END;
    EXECUTE format('SET LOCAL ROLE %I', orig);

    SET LOCAL ROLE authenticated;
    BEGIN
        SELECT count(*) INTO dummy FROM post_views;
        err := err || ' / authenticated 가 아직 post_views 를 읽는다';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;
    EXECUTE format('SET LOCAL ROLE %I', orig);

    IF err <> '' THEN
        RAISE EXCEPTION '[검증실패]%', err;
    END IF;

    -- 3) 조회수 기능이 그대로 동작하는가 — 실제로 한 번 올려보고 되돌린다.
    --    중첩 블록의 EXCEPTION 핸들러가 savepoint 역할을 해 변경이 롤백된다.
    SELECT id INTO v_post FROM posts ORDER BY id LIMIT 1;
    IF v_post IS NOT NULL THEN
        SELECT view_count INTO v_before FROM posts WHERE id = v_post;
        BEGIN
            PERFORM increment_post_view(v_post, gen_random_uuid());
            SELECT view_count INTO v_after FROM posts WHERE id = v_post;
            RAISE EXCEPTION 'rollback-probe';
        EXCEPTION WHEN OTHERS THEN
            NULL;   -- 조회수 증가·post_views 삽입 모두 되돌아간다
        END;

        IF v_after IS NULL OR v_after <> v_before + 1 THEN
            RAISE EXCEPTION '[검증실패] 조회수 증가가 동작하지 않는다 (before=%, after=%)',
                            v_before, v_after;
        END IF;

        IF (SELECT view_count FROM posts WHERE id = v_post) <> v_before THEN
            RAISE EXCEPTION '[검증실패] 시험용 조회수 증가가 원복되지 않았다';
        END IF;
    END IF;

    RAISE NOTICE '[ok] post_views 차단 · 조회수 기능 정상 (before=%, after=%)', v_before, v_after;
END
$verify$;
