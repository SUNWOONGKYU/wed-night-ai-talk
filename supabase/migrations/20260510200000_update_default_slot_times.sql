-- 기존 event_slots의 시간을 새 디폴트로 업데이트
-- 햇살 15:00, 노을 17:30, 달빛 20:00 (각 2시간 세션, 30분 휴식)

UPDATE event_slots SET slot_time = '15:00:00' WHERE slot_label = '햇살';
UPDATE event_slots SET slot_time = '17:30:00' WHERE slot_label = '노을';
UPDATE event_slots SET slot_time = '20:00:00' WHERE slot_label = '달빛';
