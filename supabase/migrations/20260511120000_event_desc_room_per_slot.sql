-- 이전 마이그레이션에서 "1)" 다음 줄에 한 줄로 추가한 회의실 안내 제거
UPDATE events
SET description = regexp_replace(
    description,
    E'\n?※ 햇살 모임은 1번 회의실, 노을·달빛 모임은 5번 회의실에서 진행됩니다\\.',
    '',
    'n'
)
WHERE description LIKE '%햇살 모임은 1번 회의실%';

-- "3) 모임 발전방향 논의" 줄 다음에 슬롯별 회의실 두 줄로 추가
UPDATE events
SET description = regexp_replace(
    description,
    E'(3\\) 모임 발전방향 논의)',
    E'\\1\n※ 햇살: 1번 회의실\n※ 노을·달빛: 5번 회의실',
    'n'
)
WHERE description LIKE '%3) 모임 발전방향 논의%'
  AND description NOT LIKE '%※ 햇살: 1번 회의실%';
