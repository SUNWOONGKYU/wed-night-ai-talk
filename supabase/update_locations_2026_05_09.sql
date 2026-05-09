-- 2026-05-09: WAAT 리브랜딩에 따른 모임 장소 데이터 갱신
-- 강남(선명회계법인) / 용산(로얄파크컨벤션) 2곳으로 통일
-- note 컬럼 비움 (지역 부연 설명 제거)

-- 기존 활성 장소 비활성화 + 모든 note 비우기
UPDATE locations SET is_active = false, note = '';

-- 신규 장소 upsert
INSERT INTO locations (name, address, map_url, note, loc_type, is_active, sort_order)
VALUES
  ('선명회계법인', '서울 강남구 테헤란로70길 16, 7층', 'https://naver.me/FoR3lmoG', '', 'primary', true, 1),
  ('로얄파크컨벤션', '서울 용산구 이태원로 29', 'https://naver.me/GlmnhduK', '', 'secondary', true, 2);
