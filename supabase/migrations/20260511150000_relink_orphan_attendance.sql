-- attendance가 비활성 슬롯을 참조하고 있는 경우,
-- 동일 event_id + 동일 slot_label의 활성 슬롯으로 재연결.
-- (slot 수정 버그로 동일 라벨의 새 슬롯이 생성되고 기존이 비활성화된 케이스 복구)

UPDATE attendance a
SET event_slot_id = active_slot.id
FROM event_slots old_slot
JOIN event_slots active_slot
  ON active_slot.event_id = old_slot.event_id
 AND active_slot.slot_label = old_slot.slot_label
 AND active_slot.is_active = true
WHERE a.event_slot_id = old_slot.id
  AND old_slot.is_active = false;
