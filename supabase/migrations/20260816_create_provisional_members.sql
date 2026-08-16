-- 2026-08-16: 예비 멤버 테이블 생성
-- 예비 멤버는 이름 + 이메일만으로 등록 (비밀번호 없음)
-- 나중에 정보 입력 완료 후 정식 멤버로 전환

CREATE TABLE IF NOT EXISTS provisional_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    source VARCHAR(50),  -- '페이스북', '카톡_댓글', '카톡_본문' 등
    created_at TIMESTAMP DEFAULT now(),
    submitted_at TIMESTAMP,  -- 정보 입력 완료 시간
    notes TEXT
);

-- 이메일로 빠른 조회를 위한 인덱스
CREATE INDEX idx_provisional_members_email ON provisional_members(email);
CREATE INDEX idx_provisional_members_submitted ON provisional_members(submitted_at);

-- 권한 설정 (RLS)
ALTER TABLE provisional_members ENABLE ROW LEVEL SECURITY;

-- 정책 1: 누구나 조회 가능 (이메일로만 확인하도록)
CREATE POLICY "예비 멤버 이메일 확인 가능"
    ON provisional_members
    FOR SELECT
    USING (true);

-- 정책 2: 관리자만 삽입 가능
CREATE POLICY "관리자만 예비 멤버 등록"
    ON provisional_members
    FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'role' = 'authenticated'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- 정책 3: 관리자만 수정 가능
CREATE POLICY "관리자만 예비 멤버 수정"
    ON provisional_members
    FOR UPDATE
    USING (
        auth.jwt() ->> 'role' = 'authenticated'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );
