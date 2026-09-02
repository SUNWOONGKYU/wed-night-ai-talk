-- =============================================
-- profiles 익명 노출 차단 — 이메일·전화번호 회수 (PO 승인, 2026-09-02)
-- =============================================
-- 확인된 사실 (20260902020000 진단 함수로 프로덕션 실측)
--   · 정책  : "Anyone can view profiles for posts"  FOR SELECT  USING (true)  TO public
--   · 권한  : anon 에게 profiles 13개 컬럼 전부 SELECT grant
--   · 결과  : 익명 요청으로 회원 298명의 이름·이메일·전화번호가 전부 조회됐다.
--             (Content-Range: 0-297/298 로 실측 확인)
--   · 이 정책은 저장소 마이그레이션 어디에도 없다 — 대시보드에서 직접 만들고
--     저장소에 반영하지 않은 드리프트다.
--
-- 정책이 만들어진 이유(이름 그대로) — 게시판이 글쓴이 이름을 보여주려면
--   posts.select('*, profiles:user_id(id, name)')
-- 처럼 남의 profiles 행을 읽어야 하고, 비로그인 방문자도 게시판을 본다.
-- 즉 '행을 보는 것' 자체는 필요했는데, 그걸 열면서 컬럼까지 통째로 열린 게 문제다.
--
-- 조치 — 행 정책은 그대로 두고(게시판 유지), 컬럼 권한만 회수한다.
--   anon 은 게시판 표시에 실제로 필요한 (id, name) 만 읽을 수 있다.
--   RLS 는 행 단위라 컬럼을 가릴 수 없으므로, 컬럼 권한(GRANT ... (col))으로 처리한다.
--
-- 남는 노출(정직하게 기록) — anon 은 여전히 회원 '이름' 목록은 볼 수 있다.
--   사이트가 이미 신청자 명단·글쓴이 이름을 공개로 보여주고 있어 성격이 같다.
--   이메일·전화번호·notes·role 은 이 마이그레이션으로 완전히 닫힌다.
--
-- 남은 과제 — authenticated 역할은 아직 전 컬럼을 읽을 수 있다(누구나 가입 가능하므로
--   실질 방어선이 약하다). 이건 본인 프로필·관리자 조회 경로를 RPC 로 옮기는
--   별도 작업이 필요해 이번 범위에서 제외한다. 후속으로 반드시 처리할 것.
-- =============================================

-- ---------------------------------------------------------------------------
-- 1) 예비멤버 확인 RPC
--    가입 모달은 '로그인 전(anon)'에 "이 이메일이 예비멤버인가?"를 물어야 한다.
--    지금까지는 profiles 행을 통째로 읽어서 판단했는데(그래서 컬럼이 열려 있어야 했다),
--    앞으로는 이 함수가 '예/아니오 + 이름'만 돌려준다.
--    판정 조건은 claim_provisional_profile() 과 동일하게 맞춘다 — 안내와 실제 병합이
--    어긋나면 "예비 멤버라더니 병합이 안 됐다"가 되기 때문.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_provisional_member(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row profiles%ROWTYPE;
    v_email text := lower(btrim(COALESCE(p_email, '')));
BEGIN
    IF v_email = '' THEN
        RETURN jsonb_build_object('is_provisional', false);
    END IF;

    SELECT p.* INTO v_row
    FROM profiles p
    WHERE lower(p.email) = v_email
      AND p.notes ILIKE '%예비 멤버%'
      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
    ORDER BY p.created_at
    LIMIT 1;

    IF NOT FOUND THEN
        -- 정규 회원이어도 false 를 돌려준다 — 이 함수로는 '예비멤버인지'만 알 수 있고
        -- 일반 회원의 가입 여부는 알 수 없다(이메일 대조 범위를 최소화).
        RETURN jsonb_build_object('is_provisional', false);
    END IF;

    -- 전화번호는 돌려주지 않는다. 예전엔 행 전체를 읽어 가입폼에 전화번호까지 자동
    -- 입력해 줬는데, 남의 이메일을 넣어도 그 사람 번호가 채워지는 노출이었다.
    RETURN jsonb_build_object(
        'is_provisional', true,
        'email', v_email,
        'name', COALESCE(v_row.name, '')
    );
END;
$$;

REVOKE ALL ON FUNCTION check_provisional_member(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_provisional_member(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) anon 컬럼 권한 회수 — 게시판 표시에 필요한 (id, name) 만 남긴다
-- ---------------------------------------------------------------------------
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, name) ON public.profiles TO anon;

-- ---------------------------------------------------------------------------
-- 3) 진단용 임시 함수 제거 (20260902020000 에서 만든 것 — 남기지 않는다)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS _waat_tmp_introspect();
