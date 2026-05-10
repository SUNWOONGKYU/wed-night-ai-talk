-- 기존 attendance가 비활성 슬롯에 연결되어 신청자 카운트가 0으로 표시되던 버그 수정
-- 같은 event + 같은 slot_label의 활성 슬롯으로 event_slot_id 재연결

UPDATE attendance a
SET event_slot_id = new_slot.id
FROM event_slots old_slot, event_slots new_slot
WHERE a.event_slot_id = old_slot.id
  AND old_slot.is_active = false
  AND new_slot.event_id = old_slot.event_id
  AND new_slot.slot_label = old_slot.slot_label
  AND new_slot.is_active = true;

-- inquiries도 동일 처리
UPDATE inquiries i
SET event_slot_id = new_slot.id
FROM event_slots old_slot, event_slots new_slot
WHERE i.event_slot_id = old_slot.id
  AND old_slot.is_active = false
  AND new_slot.event_id = old_slot.event_id
  AND new_slot.slot_label = old_slot.slot_label
  AND new_slot.is_active = true;

-- 결과 확인
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '=== 재연결 후 attendance ===';
    FOR rec IN SELECT a.id, a.event_id, a.event_slot_id, s.slot_label, s.is_active
               FROM attendance a LEFT JOIN event_slots s ON s.id = a.event_slot_id LOOP
        RAISE NOTICE 'att=% event=% slot=% label=% active=%', rec.id, rec.event_id, rec.event_slot_id, rec.slot_label, rec.is_active;
    END LOOP;
END $$;
