-- 게스트(비로그인) 사용자도 inquiries에 INSERT 가능하도록 RLS 정책 추가
-- 게스트 모임 신청, 일반 문의에서 anon 키로 접근

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- 기존 INSERT 정책 정리
DROP POLICY IF EXISTS inquiries_insert_anon ON inquiries;
DROP POLICY IF EXISTS inquiries_insert_anyone ON inquiries;
DROP POLICY IF EXISTS inquiries_insert_authenticated ON inquiries;

-- 누구나 (anon + authenticated) INSERT 허용
CREATE POLICY inquiries_insert_anyone ON inquiries
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- 관리자만 SELECT/UPDATE/DELETE 가능 (기존 정책 유지/재생성)
DROP POLICY IF EXISTS inquiries_admin_select ON inquiries;
CREATE POLICY inquiries_admin_select ON inquiries
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email IN ('wksun999@gmail.com', 'lsonic.lee@gmail.com'))
    );

DROP POLICY IF EXISTS inquiries_admin_update ON inquiries;
CREATE POLICY inquiries_admin_update ON inquiries
    FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email IN ('wksun999@gmail.com', 'lsonic.lee@gmail.com'))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email IN ('wksun999@gmail.com', 'lsonic.lee@gmail.com'))
    );

DROP POLICY IF EXISTS inquiries_admin_delete ON inquiries;
CREATE POLICY inquiries_admin_delete ON inquiries
    FOR DELETE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email IN ('wksun999@gmail.com', 'lsonic.lee@gmail.com'))
    );
