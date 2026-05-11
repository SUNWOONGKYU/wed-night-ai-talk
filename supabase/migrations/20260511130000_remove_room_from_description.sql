-- description에서 회의실 안내 줄들 모두 제거 (슬롯 카드에서 표시할 예정)
UPDATE events
SET description = regexp_replace(
    description,
    E'\n?※ 햇살:\\s*1번 회의실',
    '',
    'g'
)
WHERE description LIKE '%※ 햇살:%';

UPDATE events
SET description = regexp_replace(
    description,
    E'\n?※ 노을·달빛:\\s*5번 회의실',
    '',
    'g'
)
WHERE description LIKE '%※ 노을·달빛:%';
