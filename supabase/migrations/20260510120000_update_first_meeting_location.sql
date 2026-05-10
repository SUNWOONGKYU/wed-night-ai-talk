-- 2026-05-10: 1차 모임 장소를 선명회계법인으로 변경
UPDATE events
SET location = '선명회계법인',
    address = '서울 강남구 테헤란로70길 16, 7층',
    map_url = 'https://naver.me/FoR3lmoG'
WHERE id = 3;
