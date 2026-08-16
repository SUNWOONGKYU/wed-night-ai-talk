-- =============================================
-- 2026-08-17: claim_provisional_profile() — 승계 notes 앞에 구분자(·)가 남던 문제
-- =============================================
-- 예비멤버 notes 는 '예비 멤버 · 카톡_댓글' 형태다.
-- 기존 코드는 '예비 멤버' 만 지우고 btrim(공백만) 을 걸어서 '· 카톡_댓글' 이 남았다.
--   (2026-08-17 병합 검증에서 실측: notes = "· 검증테스트")
-- → btrim 에 가운뎃점을 포함시켜 '카톡_댓글' 만 남긴다.
--   수동으로 정리한 6건은 이미 '카톡_댓글' 형태라 표기가 통일된다.
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
    -- '예비 멤버' 문구와 남은 구분자(공백·가운뎃점)를 걷어낸 나머지 메모만 승계 후보로 삼는다.
    v_notes := NULLIF(
      btrim(regexp_replace(COALESCE(v_prov.notes, ''), '예비 멤버', '', 'g'), ' ·'),
      ''
    );

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
