-- get_member_count RPC: 메인 hero stat용 회원 수 카운트
-- 회원가입(profiles) + 게스트 신청(inquiries.user_id IS NULL distinct phone) 합산
-- 단순 profile row count로 시작

DROP FUNCTION IF EXISTS get_member_count();

CREATE OR REPLACE FUNCTION get_member_count()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT COUNT(*)::BIGINT FROM profiles;
$$;

REVOKE ALL ON FUNCTION get_member_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_member_count() TO anon, authenticated;
