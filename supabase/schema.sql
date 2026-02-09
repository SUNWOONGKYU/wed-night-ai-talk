-- =============================================
-- AI Study — Supabase DB Schema
-- Supabase SQL Editor에서 이 파일을 실행하세요
-- =============================================

-- 1. 프로필 테이블 (auth.users와 1:1)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  interests TEXT[] DEFAULT '{}',
  member_type TEXT DEFAULT '',
  message TEXT DEFAULT '',
  role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 모임 이벤트 테이블
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME,
  day_label TEXT DEFAULT '',
  location TEXT DEFAULT '',
  address TEXT DEFAULT '',
  map_url TEXT DEFAULT '',
  provision TEXT DEFAULT '',
  description TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 모임 참여 테이블 (유저 <-> 이벤트)
CREATE TABLE attendance (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, event_id)
);

-- 4. 첫 이벤트 시드 데이터
INSERT INTO events (title, event_date, event_time, location, address, map_url, provision, description)
VALUES ('1차 킥오프', '2025-02-06', '19:00', '옐로펀치 성수메사', '서울특별시 성동구 성수일로 8길 5 A동 607호', 'https://naver.me/5duYsK0I', '간단한 샌드위치 & 음료', '서로 안면 트기, 방향 설정, 첫 활동');

-- 5. 회원가입 시 프로필 자동 생성 트리거
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 6. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. Row Level Security (RLS) 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- 8. RLS 정책 — 일반 사용자
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Anyone can view active events"
  ON events FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can view own attendance"
  ON attendance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own attendance"
  ON attendance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own attendance"
  ON attendance FOR DELETE
  USING (auth.uid() = user_id);

-- 9. RLS 정책 — 관리자
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can view all events"
  ON events FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert events"
  ON events FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update events"
  ON events FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can view all attendance"
  ON attendance FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 10. 모임 장소 테이블
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  map_url TEXT DEFAULT '',
  note TEXT DEFAULT '',
  loc_type TEXT DEFAULT 'primary',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 장소 시드 데이터
INSERT INTO locations (name, address, map_url, note, loc_type, sort_order)
VALUES
  ('옐로펀치 성수메사', '서울특별시 성동구 성수일로 8길 5 A동 607호 (성수동2가 248-55)', 'https://naver.me/5duYsK0I', 'AI 연구, 바이브코딩, 서비스 개발/창업 모임, 네트워킹에 딱 맞는 공간', 'primary', 1),
  ('고척동 공간', '', '', '아담하고 포근한 공간 (주 1회 활용 가능)', 'secondary', 2);

-- 장소 RLS
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active locations"
  ON locations FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all locations"
  ON locations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert locations"
  ON locations FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update locations"
  ON locations FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete locations"
  ON locations FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 기존 DB 마이그레이션 (이미 테이블이 있는 경우):
-- ALTER TABLE events ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
-- ALTER TABLE events ADD COLUMN IF NOT EXISTS map_url TEXT DEFAULT '';
-- ALTER TABLE events ADD COLUMN IF NOT EXISTS provision TEXT DEFAULT '';
-- =============================================

-- =============================================
-- 설정 완료 후 할 일:
-- 1. Authentication > Settings > Email Auth에서 "Confirm email" OFF
-- 2. 첫 번째 관리자 계정 생성 후, Supabase Dashboard의 Table Editor에서
--    해당 사용자의 profiles 레코드의 role을 'admin'으로 변경
-- =============================================
