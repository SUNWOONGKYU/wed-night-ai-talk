-- =============================================
-- 2026-08-16: about_me 컬럼 추가 + 예비멤버 병합 RPC
-- =============================================
-- 배경
--   1) profile.js 가 존재하지 않는 about_me 컬럼에 저장을 시도해
--      PGRST204 로 프로필 저장이 통째로 실패하고 있었다. (profile.html 에는 입력 필드가 이미 있음)
--   2) 예비멤버는 auth 계정이 없는 profiles 행이다(FK 없음, email UNIQUE 없음).
--      가입하면 트리거가 새 id 로 두 번째 행을 만들어 같은 이메일 행이 둘이 되고,
--      '예비 멤버' 마크가 붙은 옛 행은 아무도 보지 않는 고아로 남는다.
--      → 예비→정규 전환이 근본적으로 동작하지 않았다.
-- =============================================

-- ---------------------------------------------------------------------------
-- 1) about_me 컬럼 추가 (순수 추가 — 기존 데이터 영향 없음)
-- ---------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS about_me TEXT DEFAULT '';

-- ---------------------------------------------------------------------------
-- 2) 예비멤버 병합 RPC
--    로그인한 사용자가 자기 이메일과 같은 예비멤버 행을 흡수하고 그 행을 삭제한다.
--    SECURITY DEFINER — 예비멤버 행은 남의 행이라 RLS 로는 손댈 수 없기 때문.
--    안전장치: auth.uid() 필수 / 자기 이메일만 / auth 계정 없는 행만 / '예비 멤버' 표시된 행만.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_provisional_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text;
  v_prov  profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '인증되지 않은 요청입니다.';
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'no_email');
  END IF;

  -- 같은 이메일의 예비멤버 행을 찾는다.
  --   · 본인 행 제외
  --   · auth 계정이 없는 행만 (실제 회원의 행을 삼키지 않도록)
  --   · '예비 멤버' 표시가 있는 행만
  SELECT p.* INTO v_prov
  FROM profiles p
  WHERE lower(p.email) = lower(v_email)
    AND p.id <> v_uid
    AND p.notes ILIKE '%예비 멤버%'
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
  ORDER BY p.created_at
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'not_provisional');
  END IF;

  -- 예비멤버가 갖고 있던 값은 '새 행이 비어 있을 때만' 옮긴다 — 사용자가 방금 입력한 값이 우선.
  -- notes 는 '예비 멤버' 문구를 제거한 나머지(가입 경로 등 메모)만 승계한다.
  UPDATE profiles n SET
      name        = COALESCE(NULLIF(n.name, ''),        v_prov.name),
      member_type = COALESCE(NULLIF(n.member_type, ''), v_prov.member_type),
      notes       = NULLIF(btrim(regexp_replace(COALESCE(v_prov.notes, ''), '예비 멤버', '', 'g')), '')
  WHERE n.id = v_uid;

  DELETE FROM profiles WHERE id = v_prov.id;

  RETURN jsonb_build_object('claimed', true, 'merged_from', v_prov.id);
END;
$$;

-- anon 은 호출 불가, 로그인 사용자만
REVOKE ALL ON FUNCTION claim_provisional_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_provisional_profile() TO authenticated;
