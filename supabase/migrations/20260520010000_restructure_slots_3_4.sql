-- =============================================
-- 3·4회차 슬롯 재편 - 2026-05-20
-- =============================================
-- 운영 결정:
--  - 햇살(13/16): slot_end_time 17:00 → 17:30
--  - 달빛(15/18): 20:00~22:00 → 19:00~21:30
--  - 노을(14/17): 폐지 (is_active=false), 신청자는 달빛으로 이동
--  - 달빛 정원: 전체 회차(6/12/15/18) capacity = 20
-- =============================================

-- ─── 안내 메일 대상 출력 (이동 전에 user 정보 확보) ───
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.name, p.email, p.phone, a.event_id, a.event_slot_id
        FROM attendance a
        JOIN profiles p ON p.id = a.user_id
        WHERE a.event_slot_id IN (14, 17)
    LOOP
        RAISE NOTICE '[NOEUL→DALBIT 이동대상] event=% slot=% name=% email=% phone=%',
            r.event_id, r.event_slot_id, r.name, r.email, r.phone;
    END LOOP;
    FOR r IN
        SELECT name, email, phone, event_id, event_slot_id
        FROM guest_attendance
        WHERE event_slot_id IN (14, 17)
    LOOP
        RAISE NOTICE '[NOEUL→DALBIT 게스트이동] event=% slot=% name=% email=% phone=%',
            r.event_id, r.event_slot_id, r.name, r.email, r.phone;
    END LOOP;
END $$;

-- ─── 1) 노을 → 달빛 이동 (UNIQUE 충돌 회피) ───
-- 같은 user가 이미 달빛에도 신청한 경우엔 노을 행만 삭제
UPDATE attendance
SET event_slot_id = CASE
    WHEN event_slot_id = 14 THEN 15
    WHEN event_slot_id = 17 THEN 18
END
WHERE event_slot_id IN (14, 17)
  AND NOT EXISTS (
    SELECT 1 FROM attendance b
    WHERE b.user_id = attendance.user_id
      AND b.event_id = attendance.event_id
      AND b.event_slot_id IN (15, 18)
      AND b.id <> attendance.id
  );

-- 충돌로 못 옮긴 노을 attendance는 삭제 (이미 달빛에도 있는 사람)
DELETE FROM attendance WHERE event_slot_id IN (14, 17);

-- 게스트는 단순 이동 후 잔여 삭제 (안전망)
UPDATE guest_attendance
SET event_slot_id = CASE
    WHEN event_slot_id = 14 THEN 15
    WHEN event_slot_id = 17 THEN 18
END
WHERE event_slot_id IN (14, 17);
DELETE FROM guest_attendance WHERE event_slot_id IN (14, 17);

-- ─── 2) 햇살 종료 시간 17:30 (3·4회차) ───
UPDATE event_slots SET slot_end_time = '17:30' WHERE id IN (13, 16);

-- ─── 3) 달빛 시간 변경 19:00~21:30 (3·4회차) ───
UPDATE event_slots SET slot_time = '19:00', slot_end_time = '21:30' WHERE id IN (15, 18);

-- ─── 4) 노을 비활성화 (3·4회차) ───
UPDATE event_slots SET is_active = false WHERE id IN (14, 17);

-- ─── 5) 전체 달빛 슬롯 정원 20명 ───
UPDATE event_slots SET capacity = 20 WHERE slot_label = '달빛';
