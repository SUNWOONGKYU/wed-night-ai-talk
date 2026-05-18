-- =============================================
-- 운영자 본인 요청: 제2회 모임(2026-05-20) '달빛' 슬롯의 운영자 attendance 삭제
-- =============================================
-- 안전장치: 이름 + 슬롯라벨 + 모임날짜 3중 매칭으로 정확히 해당 건만 삭제
-- =============================================

DELETE FROM attendance
WHERE id IN (
    SELECT a.id
    FROM attendance a
    JOIN profiles p ON p.id = a.user_id
    JOIN event_slots es ON es.id = a.event_slot_id
    JOIN events e ON e.id = a.event_id
    WHERE p.name = '선웅규'
      AND es.slot_label = '달빛'
      AND e.event_date = '2026-05-20'
);
