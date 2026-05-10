-- 사용자 결정 변경: 제공사항/참가비 다시 필요
-- "제공사항 및 참가비" 단일 필드로 사용 (예: "샌드위치 + 음료 / 참가비 1만원")
ALTER TABLE events ADD COLUMN IF NOT EXISTS provision TEXT;
