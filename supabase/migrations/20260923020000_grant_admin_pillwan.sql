-- =============================================
-- 관리자 추가: pillwan@naver.com (PO 지시, 2026-09-23)
-- =============================================
-- 권한 범위(PO 선택 3안): 관리자 페이지 조회·수정 전부, 단 관리자 지정은 불가.
-- 관리자 지정 차단은 이미 구조로 보장된다 — 추가 조치 불필요:
--   · profiles_block_privileged_column_change: API(authenticated) 경유 role 변경은 관리자라도 거부
--   · role 을 바꾸는 SECURITY DEFINER RPC·Edge Function 없음 (2026-09-23 전수 확인)
--   → 관리자 지정은 DB 소유자(대시보드·Management API)만 가능.
--
-- prevent_role_change 트리거는 auth.uid() 가 관리자가 아니면 role 변경을 조용히 되돌린다.
-- 소유자 세션엔 auth.uid() 가 없으므로, 기존 관리자(소유자) uid 를 트랜잭션 로컬 JWT 로 넣고 바꾼다.
-- =============================================

DO $grant$
DECLARE
    v_owner  uuid;
    v_target uuid;
BEGIN
    SELECT p.id INTO v_owner  FROM profiles p JOIN auth.users u ON u.id = p.id
     WHERE u.email = 'wksun999@gmail.com' AND p.role = 'admin';
    SELECT id INTO v_target FROM auth.users WHERE email = 'pillwan@naver.com';

    IF v_owner IS NULL OR v_target IS NULL THEN
        RAISE EXCEPTION '[중단] 기존 관리자 또는 대상 계정을 찾지 못함 (owner=%, target=%)', v_owner, v_target;
    END IF;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
    UPDATE profiles SET role = 'admin' WHERE id = v_target;

    IF (SELECT role FROM profiles WHERE id = v_target) <> 'admin' THEN
        RAISE EXCEPTION '[검증실패] role 이 admin 으로 바뀌지 않음';
    END IF;
    RAISE NOTICE '[ok] % 관리자 부여', v_target;
END
$grant$;
