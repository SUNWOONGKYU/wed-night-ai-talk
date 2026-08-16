-- =============================================
-- 2026-08-16: claim_provisional_profile() 보완 (V1 검증 지적 반영)
-- =============================================
-- 지적 1 [중] notes 무조건 덮어쓰기
--   name/member_type 은 COALESCE(NULLIF(새값,''), 예비값) 으로 '새 행 우선'인데
--   notes 만 조건 없이 예비행 값으로 덮어써, 그 사이 입력된 값이 조용히 유실될 수 있었다.
--   → 동일한 '새 행 우선' 패턴으로 통일한다.
--
-- 지적 2 [경] 동일 이메일 예비행이 2건 이상이면 가장 오래된 1건만 병합되고
--   나머지는 에러도 로그도 없이 고아로 남았다.
--   → 전건을 병합 대상으로 삼고, 처리 건수를 반환값에 담아 관측 가능하게 한다.
-- =============================================

CREATE OR REPLACE FUNCTION claim_provisional_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_email  text;
  v_prov   profiles%ROWTYPE;
  v_ids    uuid[] := '{}';
  v_notes  text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '인증되지 않은 요청입니다.';
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'no_email', 'merged_count', 0);
  END IF;

  -- 같은 이메일의 예비멤버 행을 오래된 순으로 '전부' 처리한다.
  --   · 본인 행 제외
  --   · auth 계정이 있는 행 제외 (실제 회원의 행을 삼키지 않도록)
  --   · '예비 멤버' 표시가 있는 행만
  FOR v_prov IN
    SELECT p.*
    FROM profiles p
    WHERE lower(p.email) = lower(v_email)
      AND p.id <> v_uid
      AND p.notes ILIKE '%예비 멤버%'
      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
    ORDER BY p.created_at
    FOR UPDATE
  LOOP
    -- '예비 멤버' 문구를 뺀 나머지 메모만 승계 후보로 삼는다.
    v_notes := NULLIF(btrim(regexp_replace(COALESCE(v_prov.notes, ''), '예비 멤버', '', 'g')), '');

    -- 세 필드 모두 '새 행에 값이 없을 때만' 승계 — 사용자가 방금 입력한 값이 우선.
    UPDATE profiles n SET
        name        = COALESCE(NULLIF(n.name, ''),        v_prov.name),
        member_type = COALESCE(NULLIF(n.member_type, ''), v_prov.member_type),
        notes       = COALESCE(NULLIF(n.notes, ''),       v_notes)
    WHERE n.id = v_uid;

    DELETE FROM profiles WHERE id = v_prov.id;
    v_ids := v_ids || v_prov.id;
  END LOOP;

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'not_provisional', 'merged_count', 0);
  END IF;

  RETURN jsonb_build_object(
    'claimed', true,
    'merged_count', array_length(v_ids, 1),
    'merged_from', to_jsonb(v_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION claim_provisional_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_provisional_profile() TO authenticated;
