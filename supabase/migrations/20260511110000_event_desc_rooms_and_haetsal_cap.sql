-- 모든 모임 description의 "1) AI 관련 수다" 다음 줄에 회의실 안내 추가
-- ※ 햇살 모임: 1번 회의실 / 노을·달빛 모임: 5번 회의실
-- 이미 있는 경우 중복 추가하지 않도록 ILIKE 체크

UPDATE events
SET description = regexp_replace(
    description,
    '(1\) AI 관련 수다)',
    E'\\1\n※ 햇살 모임은 1번 회의실, 노을·달빛 모임은 5번 회의실에서 진행됩니다.',
    'n'
)
WHERE description LIKE '%1) AI 관련 수다%'
  AND description NOT LIKE '%햇살 모임은 1번 회의실%';

-- ev=3 (1회차) 끝에 붙어있던 "* 5번 회의실" 라인 제거 (중복 방지)
UPDATE events
SET description = regexp_replace(description, E'\\s*\\*\\s*5번 회의실\\s*$', '', 'n')
WHERE description LIKE '%* 5번 회의실%';

-- 햇살 슬롯 정원을 전 회차 6으로 통일
UPDATE event_slots
SET capacity = 6
WHERE slot_label = '햇살'
  AND is_active = true;
