-- 휘경빌딩/희경빌딩 표기 통일 (DB에 이미 희경빌딩으로 들어있음)
-- 1. 내가 직전 마이그레이션에서 잘못 추가한 휘경빌딩 빈 row 삭제
-- 2. 기존 희경빌딩을 secondary, sort_order=3, is_active=true 로 갱신

DELETE FROM locations
WHERE name = '휘경빌딩'
  AND COALESCE(address, '') = ''
  AND COALESCE(map_url, '') = '';

UPDATE locations
SET sort_order = 3, is_active = true, loc_type = 'secondary'
WHERE name = '희경빌딩';
