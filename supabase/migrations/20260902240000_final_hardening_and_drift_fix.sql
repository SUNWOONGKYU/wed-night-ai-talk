-- =============================================
-- 최종 정리 — 이중 방어 보강 + 저장소 드리프트 수습 (PO 지시, 2026-09-02)
-- =============================================
-- 전수 감사 결과 (REST 실측 + 정책·권한 메타데이터)
--   · RLS 는 public 스키마 전 테이블에 켜져 있다
--   · 익명 조회는 의도한 것만 열려 있다 (events / event_slots / posts / comments /
--     locations / post_reactions — 전부 공개 게시물·모임 정보)
--   · anon 실행 가능 함수의 가드도 전부 정상 (관리자 함수는 42501 로 거부됨을 실호출로 확인)
--
-- 남은 두 가지를 여기서 정리한다.
-- =============================================

-- ---------------------------------------------------------------------------
-- 1) 이중 방어 — RLS 는 막고 있지만 컬럼 권한이 남아 있던 테이블
--
--    inquiries · email_logs · guest_attendance 는 익명에게 SELECT 권한이 남아 있었다.
--    지금은 RLS 정책이 0행으로 걸러 주고 있어 실제 유출은 없다(REST 실측: */0).
--    하지만 오늘 profiles·attendance 에서 확인했듯 정책은 대시보드에서 잘못 열리기
--    쉽다 — 그때 권한마저 없으면 두 번째 벽이 된다. 오늘 만든 나머지 테이블과
--    같은 기준으로 맞춘다.
--
--    authenticated 는 건드리지 않는다 — 관리자 화면이 이 세 테이블을 읽는다
--    (getAllInquiries / getEventAttendees 의 게스트 조회 / getEmailLogs).
--    익명은 어느 것도 읽을 이유가 없다.
--    ※ 문의 등록(익명 INSERT)은 영향 없다 — createInquiry 는 .select() 를 쓰지 않는다.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON public.inquiries        FROM anon;
REVOKE SELECT ON public.email_logs       FROM anon;
REVOKE SELECT ON public.guest_attendance FROM anon;

-- ---------------------------------------------------------------------------
-- 2) 드리프트 수습 — delete_user()
--
--    프로덕션에는 있는데 저장소 마이그레이션 어디에도 없던 함수다(대시보드 생성).
--    관리자 가드는 제대로 걸려 있었으나, 판별을 profiles.role 로 직접 하고 있어
--    오늘 단일화한 is_admin() 경로를 타지 않았다.
--    프로덕션에서 원본 정의를 그대로 가져와 저장소에 등재하면서 is_admin() 으로 맞춘다.
--    (SECURITY DEFINER 안이라 profiles.role 직접 참조도 동작하지만, 관리자 판별이
--     두 갈래로 남으면 나중에 한쪽만 고치는 사고가 난다)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Permission denied: admin only';
    END IF;

    -- profiles 삭제 (attendance 는 CASCADE 로 함께 삭제된다)
    DELETE FROM profiles WHERE id = target_user_id;

    -- auth 계정 삭제
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) 진단용 임시 함수 제거 (20260902230000 / 231000 / 232000)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS _waat_tmp_audit(text);
DROP FUNCTION IF EXISTS _waat_tmp_audit2(text);
DROP FUNCTION IF EXISTS _waat_tmp_audit3(text);

-- ---------------------------------------------------------------------------
-- 4) 검증 — 실패하면 전체 롤백
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
    orig     text := current_user;
    err      text := '';
    dummy    int;
    leftover text;
BEGIN
    -- 4-0) 임시 함수가 남아 있으면 안 된다
    SELECT string_agg(p.proname, ', ') INTO leftover
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname LIKE '\_waat\_tmp\_%';
    IF leftover IS NOT NULL THEN
        RAISE EXCEPTION '[검증실패] 임시 함수가 남아 있다: %', leftover;
    END IF;

    -- 4-1) anon 은 세 테이블을 읽지 못해야 한다
    SET LOCAL ROLE anon;
    BEGIN SELECT count(*) INTO dummy FROM inquiries;
        err := err || ' / anon 이 inquiries 를 읽는다';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN SELECT count(*) INTO dummy FROM email_logs;
        err := err || ' / anon 이 email_logs 를 읽는다';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN SELECT count(*) INTO dummy FROM guest_attendance;
        err := err || ' / anon 이 guest_attendance 를 읽는다';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

    -- 4-2) 익명에게 계속 열려 있어야 하는 것 (사이트가 이걸로 돌아간다)
    BEGIN SELECT count(*) INTO dummy FROM posts;
    EXCEPTION WHEN insufficient_privilege THEN err := err || ' / posts 조회가 막혔다'; END;
    BEGIN SELECT count(*) INTO dummy FROM events;
    EXCEPTION WHEN insufficient_privilege THEN err := err || ' / events 조회가 막혔다'; END;
    BEGIN SELECT count(*) INTO dummy FROM event_slots;
    EXCEPTION WHEN insufficient_privilege THEN err := err || ' / event_slots 조회가 막혔다'; END;
    BEGIN SELECT count(*) INTO dummy FROM comments;
    EXCEPTION WHEN insufficient_privilege THEN err := err || ' / comments 조회가 막혔다'; END;

    EXECUTE format('SET LOCAL ROLE %I', orig);

    -- 4-3) 관리자 화면 경로 — authenticated 는 계속 읽을 수 있어야 한다
    SET LOCAL ROLE authenticated;
    BEGIN SELECT count(*) INTO dummy FROM inquiries;
    EXCEPTION WHEN insufficient_privilege THEN err := err || ' / authenticated 가 inquiries 를 못 읽는다'; END;
    BEGIN SELECT count(*) INTO dummy FROM email_logs;
    EXCEPTION WHEN insufficient_privilege THEN err := err || ' / authenticated 가 email_logs 를 못 읽는다'; END;
    BEGIN SELECT count(*) INTO dummy FROM guest_attendance;
    EXCEPTION WHEN insufficient_privilege THEN err := err || ' / authenticated 가 guest_attendance 를 못 읽는다'; END;
    EXECUTE format('SET LOCAL ROLE %I', orig);

    IF err <> '' THEN
        RAISE EXCEPTION '[검증실패]%', err;
    END IF;

    RAISE NOTICE '[ok] 최종 정리 검증 통과';
END
$verify$;
