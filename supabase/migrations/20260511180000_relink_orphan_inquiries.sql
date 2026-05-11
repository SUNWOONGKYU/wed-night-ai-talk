-- inquiries(게스트 신청)도 비활성 슬롯을 가리키는 경우 동일 event+label의 활성 슬롯으로 재연결
-- attendance에 대해서는 이미 20260511150000에서 처리됨. inquiries는 빠져있어 추가.

UPDATE inquiries i
SET event_slot_id = active_slot.id
FROM event_slots old_slot
JOIN event_slots active_slot
  ON active_slot.event_id = old_slot.event_id
 AND active_slot.slot_label = old_slot.slot_label
 AND active_slot.is_active = true
WHERE i.event_slot_id = old_slot.id
  AND old_slot.is_active = false;

-- 재연결 후 중복 발생 가능성: 같은 phone+event+slot로 모이는 케이스 정리
-- (UNIQUE 인덱스 uniq_inquiries_phone_event_slot가 INSERT는 막지만, UPDATE로 인한 중복은 위에서 발생 가능)
DELETE FROM inquiries
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY phone, event_id, event_slot_id
                   ORDER BY created_at ASC, id ASC
               ) AS rn
        FROM inquiries
        WHERE phone IS NOT NULL
          AND event_id IS NOT NULL
          AND event_slot_id IS NOT NULL
    ) ranked
    WHERE rn > 1
);
