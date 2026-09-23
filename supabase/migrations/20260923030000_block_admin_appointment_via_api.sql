-- =============================================
-- 관리자 지정(role 변경)을 API 경유로는 전면 차단 (PO 3안, 2026-09-23)
-- =============================================
-- 결함: profiles_block_privileged_column_change 는 current_user = 'authenticated' 일 때 막는데,
-- 함수가 SECURITY DEFINER 라 실행 중 current_user 는 소유자(postgres)다 → 조건이 한 번도 참이 안 됨.
-- 실제로 막고 있던 건 prevent_role_change 뿐이었고, 그건 "관리자면 허용"이라
-- 관리자 누구나 다른 회원을 관리자로 만들 수 있었다 (2026-09-23 시험으로 확인).
--
-- 조치: prevent_role_change 가 API 요청(role GUC = authenticated/anon)이면 관리자라도 거부한다.
--   · role GUC 는 SECURITY DEFINER 안에서도 호출자 값을 유지한다 (시험 확인).
--   · 관리자 지정은 DB 소유자 세션(대시보드 SQL·Management API)에서만 가능.
--   · email 차단(같은 결함)은 claim_provisional_profile 동작과 얽혀 있어 이번 범위에서 제외.
-- =============================================

CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role
       AND coalesce(current_setting('role', true), '') IN ('authenticated', 'anon') THEN
        RAISE EXCEPTION '권한(role)은 변경할 수 없습니다' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 검증 — 관리자 계정으로 API 흉내 → 거부돼야 한다. 실패하면 롤백
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
    v_admin  uuid;
    v_member uuid;
    v_msg    text := 'NO ERROR';
BEGIN
    SELECT id INTO v_admin  FROM profiles WHERE role = 'admin'  ORDER BY created_at LIMIT 1;
    SELECT id INTO v_member FROM profiles WHERE role = 'member' ORDER BY created_at LIMIT 1;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN
        UPDATE profiles SET role = 'admin' WHERE id = v_member;
    EXCEPTION WHEN OTHERS THEN v_msg := SQLERRM;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);

    IF (SELECT role FROM profiles WHERE id = v_member) <> 'member' THEN
        RAISE EXCEPTION '[검증실패] 관리자가 API 로 다른 회원을 관리자로 만들 수 있다';
    END IF;
    RAISE NOTICE '[ok] API 경유 관리자 지정 차단: %', v_msg;
END
$verify$;
