-- 2026-05-09: WAAT 리브랜딩에 따른 모임 장소 데이터 갱신
-- 강남(선명회계법인) / 용산(로얄파크컨벤션) 2곳으로 통일

-- 기존 활성 장소 비활성화
UPDATE locations SET is_active = false;

-- 신규 장소 upsert
INSERT INTO locations (name, address, map_url, note, loc_type, is_active, sort_order)
VALUES
  ('선명회계법인', '서울 강남구 테헤란로70길 16, 7층', 'https://naver.me/FoR3lmoG', '강남 테헤란로 일대, 평일 오후 모임 베이스', 'primary', true, 1),
  ('로얄파크컨벤션', '서울 용산구 이태원로 29', 'https://naver.me/GlmnhduK', '용산·이태원 권역, 대규모 모임 가능', 'secondary', true, 2);
