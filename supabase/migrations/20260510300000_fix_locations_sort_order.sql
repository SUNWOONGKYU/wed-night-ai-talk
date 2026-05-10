-- locations sort_order 정정
-- 현재 상태: 희경빌딩(id=5) sort=0, 선명회계법인(id=6) sort=1, 로얄파크컨벤션(id=7) sort=2
-- 목표: 선명 → 1 (좌상단), 로얄파크 → 2 (우상단), 희경 → 3 (아래)

UPDATE locations SET sort_order = 1 WHERE name = '선명회계법인';
UPDATE locations SET sort_order = 2 WHERE name = '로얄파크컨벤션';
UPDATE locations SET sort_order = 3 WHERE name = '서울 AI 허브 희경빌딩';
