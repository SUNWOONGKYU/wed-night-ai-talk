-- 수정 버그로 누적된 비활성 중복 슬롯 정리
-- 동일 (event_id, slot_label) 그룹에서 활성 슬롯이 1개라도 있으면
-- 같은 라벨의 비활성 슬롯들 중 참여자 기록(attendance)이 없는 것만 삭제
-- attendance가 걸린 슬롯은 데이터 보존을 위해 유지

DELETE FROM event_slots es
WHERE es.is_active = false
  AND NOT EXISTS (
    SELECT 1 FROM attendance a WHERE a.event_slot_id = es.id
  )
  AND EXISTS (
    SELECT 1 FROM event_slots es2
    WHERE es2.event_id = es.event_id
      AND es2.slot_label = es.slot_label
      AND es2.is_active = true
  );
