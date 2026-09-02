-- =============================================
-- profiles: authenticated 역할의 전체 컬럼 조회 차단 (PO 승인, 2026-09-02)
-- =============================================
-- 남은 노출 — 20260902030000 에서 anon 은 (id, name) 으로 줄였지만 authenticated 는
-- 그대로 13개 컬럼을 다 읽을 수 있었다. 이 사이트는 누구나 가입할 수 있으므로
-- "로그인만 하면 회원 전원의 이메일·전화번호를 조회할 수 있다" 는 뜻이고,
-- 실질 방어선이 없는 것과 같다.
--
-- 조치 — anon 과 같은 방식이다. 행 정책은 그대로 두고(게시판 글쓴이 이름 표시에 필요)
-- 컬럼 권한만 (id, name) 으로 줄이고, 정당한 조회 경로는 RPC 로 연다.
--
-- 조사한 실제 조회 경로 (js 전수 확인)
--   ① DB.getProfile(userId)          — 호출 8곳 전부 '본인' id     → get_my_profile()
--   ② DB.updateProfile(...).select() — 본인 수정 후 갱신 행 반환   → .select() 제거 + ①
--   ③ DB.getAllProfiles()            — admin.js 회원 목록(관리자)  → admin_list_profiles()
--   ④ getEventAttendees 내 프로필 매핑 — 관리자 신청자 명단        → admin_get_profiles(ids)
--   ⑤ posts/comments 임베드 profiles(id, name) — 남는 권한으로 그대로 동작
--   그 외 db.js 의 createProfile / getExistingEmails 는 호출자 없는 죽은 코드다.
--
-- ⚠️ 선행 조치가 필요했다 (첫 시도에서 검증에 걸려 롤백됐다)
--    RLS 정책 식에서 참조하는 컬럼에도 컬럼 권한이 적용된다. 그런데 관리자 정책
--    8개가 `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`
--    형태로 profiles.role 을 읽고 있었다. 컬럼 권한만 회수하면 이 정책이 걸린
--    테이블 조회가 통째로 permission denied 가 된다(실측 확인).
--    → 아래 1) 에서 전부 is_admin()(JWT 이메일 기반 SECURITY DEFINER) 으로 옮긴다.
--      is_admin() 은 profiles 를 읽지 않으므로 컬럼 권한과 무관해진다.
-- =============================================

-- ---------------------------------------------------------------------------
-- 1) profiles.role 을 참조하는 정책 8개를 is_admin() 기반으로 교체
--    (pg_policies 실측 목록 — 저장소 schema.sql 과 프로덕션이 일부 달랐다)
-- ---------------------------------------------------------------------------

-- 1-1) attendance : SELECT
--      is_admin() 판 attendance_select_admin 은 20260902040000 에서 이미 만들었다.
--      여기서는 profiles.role 을 읽는 구 정책만 제거한다.
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;

-- 1-2) comments : DELETE
DROP POLICY IF EXISTS "Admins can delete any comment" ON public.comments;
DROP POLICY IF EXISTS comments_admin_delete ON public.comments;
CREATE POLICY comments_admin_delete ON public.comments
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- 1-3) events : DELETE
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
DROP POLICY IF EXISTS events_admin_delete ON public.events;
CREATE POLICY events_admin_delete ON public.events
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- 1-4) events : UPDATE
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS events_admin_update ON public.events;
CREATE POLICY events_admin_update ON public.events
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 1-5) guest_attendance : SELECT / DELETE
DROP POLICY IF EXISTS guest_attendance_select_admin ON public.guest_attendance;
CREATE POLICY guest_attendance_select_admin ON public.guest_attendance
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS guest_attendance_delete_admin ON public.guest_attendance;
CREATE POLICY guest_attendance_delete_admin ON public.guest_attendance
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- 1-6) posts : DELETE
DROP POLICY IF EXISTS "Admins can delete any post" ON public.posts;
DROP POLICY IF EXISTS posts_admin_delete ON public.posts;
CREATE POLICY posts_admin_delete ON public.posts
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- 1-7) profiles : 본인 수정 정책
--    구 정책은 WITH CHECK 안에서 profiles 를 다시 읽어 role·email 변경을 막고 있었다.
--      role  = (SELECT role  FROM profiles WHERE id = auth.uid())
--      email = (SELECT email FROM profiles WHERE id = auth.uid())
--    컬럼 권한을 회수하면 이 식이 성립하지 않으므로, 같은 의미를 트리거로 옮긴다.
--    거부 방식(에러)까지 구 정책과 동일하게 맞춘다 — 조용히 무시하면 값이 바뀐 줄
--    알고 지나가는 버그가 된다.
CREATE OR REPLACE FUNCTION profiles_block_privileged_column_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 회원이 직접 보내는 UPDATE(=authenticated 역할)에서만 막는다.
    -- SECURITY DEFINER RPC(claim_provisional_profile 등)는 소유자 권한으로 돌므로
    -- 이 분기를 타지 않는다 — 예비멤버 병합이 email 을 옮기는 동작을 깨지 않기 위함이다.
    IF current_user = 'authenticated' THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION '권한(role)은 변경할 수 없습니다' USING ERRCODE = '42501';
        END IF;
        IF NEW.email IS DISTINCT FROM OLD.email THEN
            RAISE EXCEPTION '이메일은 변경할 수 없습니다' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_privileged_column_change ON public.profiles;
CREATE TRIGGER profiles_block_privileged_column_change
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION profiles_block_privileged_column_change();

DROP POLICY IF EXISTS "Users can update own profile (no role/email)" ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2) 본인 프로필 조회 RPC
--    인자를 받지 않는다 — 항상 auth.uid() 의 행만 돌려준다. 남의 id 로 조회하는 것
--    자체가 불가능해야 하므로 파라미터를 두지 않았다.
--    행이 없으면(가입 트리거 직후) NULL — 호출부가 폴링으로 기다린다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT to_jsonb(p) FROM profiles p WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION get_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_profile() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) 관리자 — 회원 전체 목록
-- ---------------------------------------------------------------------------
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
        (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC) FROM profiles p),
        '[]'::jsonb
    );
END;
$$;

REVOKE ALL ON FUNCTION admin_list_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_profiles() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) 관리자 — id 목록으로 프로필 조회 (신청자 명단의 이름·연락처 매핑용)
-- ---------------------------------------------------------------------------
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
        (SELECT jsonb_agg(to_jsonb(p)) FROM profiles p WHERE p.id = ANY(p_ids)),
        '[]'::jsonb
    );
END;
$$;

REVOKE ALL ON FUNCTION admin_get_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_get_profiles(uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) 컬럼 권한 회수 — 게시판 표시에 필요한 (id, name) 만 남긴다
--    UPDATE 권한은 건드리지 않는다. 본인 프로필 수정은 그대로 동작한다.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, name) ON public.profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) 검증 — authenticated 역할로 직접 쿼리해 확인한다.
--    실패하면 EXCEPTION → 전체 롤백 → 잠금이 적용되지 않는다.
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
    dummy    int;
    blocked  boolean;
    leftover text;
    orig     text := current_user;   -- CLI 가 SET ROLE 해둔 역할 — 반드시 이걸로 되돌린다
    err      text := '';
BEGIN
    -- 6-0) profiles.role 을 참조하는 정책이 남아 있으면 안 된다
    SELECT string_agg(tablename || '.' || policyname, ', ')
      INTO leftover
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%profiles%'
       AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%role%';
    IF leftover IS NOT NULL THEN
        RAISE EXCEPTION '[검증실패] profiles.role 을 참조하는 정책이 남아 있다: %', leftover;
    END IF;

    -- 역할을 바꾼 구간에서는 예외를 던지지 않는다. 실패를 err 에 모아두고,
    -- 역할을 되돌린 뒤에 한 번에 raise 한다 (역할이 바뀐 채 트랜잭션이 끝나면
    -- CLI 가 마이그레이션 이력을 기록하지 못해 전체가 롤백된다).
    SET LOCAL ROLE authenticated;

    -- 6-1) 허용되어야 하는 것: (id, name)
    BEGIN
        PERFORM p.id, p.name FROM profiles p LIMIT 1;
    EXCEPTION WHEN insufficient_privilege THEN
        err := err || ' / authenticated 가 profiles(id,name) 을 읽지 못한다 — 게시판 글쓴이 이름이 깨진다';
    END;

    -- 6-2) 차단되어야 하는 것: email
    blocked := false;
    BEGIN
        PERFORM p.email FROM profiles p LIMIT 1;
    EXCEPTION WHEN insufficient_privilege THEN
        blocked := true;
    END;
    IF NOT blocked THEN
        err := err || ' / authenticated 가 아직 profiles.email 을 읽을 수 있다';
    END IF;

    -- 6-3) 차단되어야 하는 것: phone
    blocked := false;
    BEGIN
        PERFORM p.phone FROM profiles p LIMIT 1;
    EXCEPTION WHEN insufficient_privilege THEN
        blocked := true;
    END;
    IF NOT blocked THEN
        err := err || ' / authenticated 가 아직 profiles.phone 을 읽을 수 있다';
    END IF;

    -- 6-4) 기존 조회 경로가 살아 있는가 (테이블별로 따로 확인한다)
    BEGIN
        SELECT count(*) INTO dummy FROM events;
    EXCEPTION WHEN insufficient_privilege THEN err := err || ' / events 조회가 막혔다'; END;
    BEGIN
        SELECT count(*) INTO dummy FROM attendance;
    EXCEPTION WHEN insufficient_privilege THEN err := err || ' / attendance 조회가 막혔다'; END;
    BEGIN
        SELECT count(*) INTO dummy FROM posts;
    EXCEPTION WHEN insufficient_privilege THEN err := err || ' / posts 조회가 막혔다'; END;
    BEGIN
        SELECT count(*) INTO dummy FROM comments;
    EXCEPTION WHEN insufficient_privilege THEN err := err || ' / comments 조회가 막혔다'; END;
    BEGIN
        SELECT count(*) INTO dummy FROM event_slots;
    EXCEPTION WHEN insufficient_privilege THEN err := err || ' / event_slots 조회가 막혔다'; END;

    -- 6-5) 게시판 임베드와 같은 형태의 조인
    BEGIN
        SELECT count(*) INTO dummy
          FROM posts po LEFT JOIN profiles p ON p.id = po.user_id;
    EXCEPTION WHEN insufficient_privilege THEN
        err := err || ' / posts x profiles 조인이 막혔다 — 게시판이 깨진다';
    END;

    -- 역할 복구 (RESET ROLE 이 아니라 원래 역할로 되돌린다)
    EXECUTE format('SET LOCAL ROLE %I', orig);

    IF err <> '' THEN
        RAISE EXCEPTION '[검증실패]%', err;
    END IF;

    RAISE NOTICE '[ok] authenticated 검증 통과';
END
$verify$;
