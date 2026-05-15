-- 1회차 햇살(slot=28) [member-B] (phone=[masked-phone]) attendance 삭제

DELETE FROM attendance
WHERE id IN (
    SELECT a.id
    FROM attendance a
    JOIN profiles p ON p.id = a.user_id
    WHERE a.event_id = 3
      AND a.event_slot_id = 28
      AND p.name = '[member-B]'
      AND p.phone = '[masked-phone]'
);
