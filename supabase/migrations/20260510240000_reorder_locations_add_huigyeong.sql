-- 모임 장소 재구성
-- 1. 선명회계법인 (primary) — 좌상단
-- 2. 로얄파크컨벤션 (secondary) — 우상단
-- 3. 휘경빌딩 (secondary) — 아래 (주소·URL은 admin에서 입력)

-- 선명회계법인: sort_order 1 (변경 없음)
UPDATE locations SET sort_order = 1, is_active = true
WHERE name = '선명회계법인';

-- 로얄파크컨벤션: sort_order 2 (변경 없음, 한자/한글 표기 통일)
UPDATE locations SET sort_order = 2, is_active = true
WHERE name IN ('로얄파크컨벤션', '로열파크컨벤션', '로얄파크컨벤션센터');

-- 휘경빌딩 추가 (이미 있으면 활성화/순서만 갱신)
INSERT INTO locations (name, address, map_url, note, loc_type, is_active, sort_order)
SELECT '휘경빌딩', '', '', '', 'secondary', true, 3
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE name = '휘경빌딩');

UPDATE locations SET sort_order = 3, is_active = true, loc_type = 'secondary'
WHERE name = '휘경빌딩';
