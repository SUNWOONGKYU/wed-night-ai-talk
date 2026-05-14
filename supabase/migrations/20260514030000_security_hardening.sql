-- =============================================
-- 보안 강화 마이그레이션 (2026-05-14)
-- =============================================
-- 적용 방법: Supabase Dashboard → SQL Editor 에서 본 파일 전체를 붙여넣고 실행
--
-- 포함 내용:
--   1) profiles UPDATE 정책 — role/email 자기 승격 차단
--   2) admin_delete_attendance RPC 신규 생성 (관리자만)
--   3) increment_post_view 중복 방지 (post_views 테이블 + UNIQUE)
--   4) guest_attendance 입력 검증 강화 (서버 측 trigger)
--   5) inquiries anon insert rate-limit (IP/일 제한은 Edge Function 권장 — 본 SQL 은 길이 제한만)
-- =============================================

-- -----------------------------------------------------------------------------
-- 1) profiles UPDATE 정책 강화
--    기존: USING (auth.uid() = id)  ← role 컬럼 자기 변경 가능 (관리자 자기승격)
--    수정: WITH CHECK 절에서 role / email 변경 금지
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile (no role/email)" ON profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND role = (SELECT role FROM profiles WHERE id = auth.uid())
        AND email = (SELECT email FROM profiles WHERE id = auth.uid())
    );

-- 관리자(JWT 기준)는 별도 정책으로 role/email 까지 수정 가능
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile" ON profiles
    FOR UPDATE
    USING (is_admin())
    WITH CHECK (is_admin());

-- -----------------------------------------------------------------------------
-- 2) admin_delete_attendance RPC
--    클라이언트(supabase-config.js)에서 호출되고 있으나 정의가 없었음
--    is_admin() (JWT 기반) 으로 가드
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_delete_attendance(p_attendance_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'permission denied: admin only';
    END IF;

    DELETE FROM attendance WHERE id = p_attendance_id;
END;
$$;

REVOKE ALL ON FUNCTION admin_delete_attendance(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_attendance(BIGINT) TO authenticated;

-- guest_attendance 도 같이 삭제 가능하도록
CREATE OR REPLACE FUNCTION admin_delete_guest_attendance(p_guest_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'permission denied: admin only';
    END IF;

    DELETE FROM guest_attendance WHERE id = p_guest_id;
END;
$$;

REVOKE ALL ON FUNCTION admin_delete_guest_attendance(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_guest_attendance(BIGINT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3) increment_post_view 중복/스팸 방지
--    기존: 인자만 받으면 무조건 +1 → 임의 게시글 조회수 무한 증가 가능
--    개선: post_views 테이블에 (post_id, viewer_key) UNIQUE 로 1회만 증가
--          viewer_key = auth.uid()::text (로그인) | 'anon:'||md5(ip+date) 형태는
--          DB 단독으로 불가하므로 비로그인은 세션단위 카운트 제외 (악용 차단 우선)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_views (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    viewer_id UUID NOT NULL,
    viewed_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (post_id, viewer_id)
);

ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_views readable by all" ON post_views;
CREATE POLICY "post_views readable by all" ON post_views FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION increment_post_view(p_post_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_inserted BOOLEAN := FALSE;
BEGIN
    -- 비로그인은 조회수 무효 (스팸 차단). 로그인 사용자만 카운트.
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

REVOKE ALL ON FUNCTION increment_post_view(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_post_view(INTEGER) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4) guest_attendance 입력 검증 (이름 길이 / 이메일 형식)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_guest_attendance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- 이름 trim + 길이 1~30
    NEW.name := trim(NEW.name);
    IF NEW.name IS NULL OR length(NEW.name) < 1 OR length(NEW.name) > 30 THEN
        RAISE EXCEPTION 'invalid guest name length';
    END IF;

    -- 이메일이 있다면 형식 체크
    IF NEW.email IS NOT NULL AND length(NEW.email) > 0 THEN
        IF NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
            RAISE EXCEPTION 'invalid guest email format';
        END IF;
    END IF;

    -- 전화번호가 있다면 숫자만 + 길이 10~11
    IF NEW.phone IS NOT NULL AND length(NEW.phone) > 0 THEN
        IF NEW.phone !~ '^[0-9]{10,11}$' THEN
            RAISE EXCEPTION 'invalid guest phone format';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_guest_attendance ON guest_attendance;
CREATE TRIGGER trg_validate_guest_attendance
    BEFORE INSERT OR UPDATE ON guest_attendance
    FOR EACH ROW
    EXECUTE FUNCTION validate_guest_attendance();

-- -----------------------------------------------------------------------------
-- 5) inquiries 길이 가드 (스팸 무한 텍스트 방지)
--    rate limit 은 Supabase Edge Function 또는 Cloudflare 권장
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_inquiry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.name    := trim(NEW.name);
    NEW.subject := trim(NEW.subject);
    NEW.message := trim(NEW.message);

    IF length(NEW.name)    < 1 OR length(NEW.name)    > 50  THEN RAISE EXCEPTION 'invalid name';    END IF;
    IF length(NEW.subject) < 1 OR length(NEW.subject) > 200 THEN RAISE EXCEPTION 'invalid subject'; END IF;
    IF length(NEW.message) < 1 OR length(NEW.message) > 2000 THEN RAISE EXCEPTION 'invalid message'; END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_inquiry ON inquiries;
CREATE TRIGGER trg_validate_inquiry
    BEFORE INSERT OR UPDATE ON inquiries
    FOR EACH ROW
    EXECUTE FUNCTION validate_inquiry();

-- =============================================
-- 끝.
-- =============================================
