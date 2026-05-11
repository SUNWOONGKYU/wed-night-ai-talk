-- attendance/inquiries의 event_slot_id가 다른 이벤트의 슬롯을 가리키는 부정합 수정 + 재발 방지
-- + 동일 사용자/연락처가 같은 이벤트에 중복 등록된 행 정리

-- ============================================
-- 1. 중복 정리 — attendance
-- ============================================
-- (user_id, event_id) 동일하면서 한쪽은 cross-event 슬롯을 가진 경우, cross-event 행 삭제
DELETE FROM attendance
WHERE id IN (
    SELECT a.id
    FROM attendance a
    JOIN event_slots wrong_slot ON wrong_slot.id = a.event_slot_id
    WHERE wrong_slot.event_id <> a.event_id     -- a는 cross-event 행
      AND EXISTS (
          SELECT 1
          FROM attendance good
          JOIN event_slots good_slot ON good_slot.id = good.event_slot_id
          WHERE good.user_id = a.user_id
            AND good.event_id = a.event_id
            AND good.id <> a.id
            AND good_slot.event_id = good.event_id   -- 정상 슬롯
      )
);

-- ============================================
-- 2. 잔존 cross-event 행 재연결 — attendance
-- ============================================
UPDATE attendance a
SET event_slot_id = active_slot.id
FROM event_slots wrong_slot, event_slots active_slot
WHERE a.event_slot_id = wrong_slot.id
  AND wrong_slot.event_id <> a.event_id
  AND active_slot.event_id = a.event_id
  AND active_slot.slot_label = wrong_slot.slot_label
  AND active_slot.is_active = true;

-- ============================================
-- 3. 중복 정리 — inquiries (게스트 신청, phone 기준)
-- ============================================
DELETE FROM inquiries
WHERE id IN (
    SELECT i.id
    FROM inquiries i
    JOIN event_slots wrong_slot ON wrong_slot.id = i.event_slot_id
    WHERE wrong_slot.event_id <> i.event_id
      AND EXISTS (
          SELECT 1
          FROM inquiries good
          JOIN event_slots good_slot ON good_slot.id = good.event_slot_id
          WHERE good.phone = i.phone
            AND good.event_id = i.event_id
            AND good.id <> i.id
            AND good_slot.event_id = good.event_id
      )
);

-- ============================================
-- 4. 잔존 cross-event 행 재연결 — inquiries
-- ============================================
UPDATE inquiries i
SET event_slot_id = active_slot.id
FROM event_slots wrong_slot, event_slots active_slot
WHERE i.event_slot_id = wrong_slot.id
  AND wrong_slot.event_id <> i.event_id
  AND active_slot.event_id = i.event_id
  AND active_slot.slot_label = wrong_slot.slot_label
  AND active_slot.is_active = true;

-- ============================================
-- 5. 트리거: 향후 cross-event 참조 차단 — attendance
-- ============================================
CREATE OR REPLACE FUNCTION attendance_check_slot_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_slot_event INTEGER;
BEGIN
    IF NEW.event_slot_id IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT event_id INTO v_slot_event FROM event_slots WHERE id = NEW.event_slot_id;
    IF v_slot_event IS NULL THEN
        RAISE EXCEPTION '존재하지 않는 슬롯 ID: %', NEW.event_slot_id;
    END IF;
    IF v_slot_event <> NEW.event_id THEN
        RAISE EXCEPTION '슬롯(%)이 다른 이벤트(% vs %)에 속해 있어 신청할 수 없습니다.',
            NEW.event_slot_id, v_slot_event, NEW.event_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_slot_event_check ON attendance;
CREATE TRIGGER attendance_slot_event_check
    BEFORE INSERT OR UPDATE OF event_slot_id, event_id ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION attendance_check_slot_event();

-- ============================================
-- 6. 트리거: 향후 cross-event 참조 차단 — inquiries
-- ============================================
CREATE OR REPLACE FUNCTION inquiries_check_slot_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_slot_event INTEGER;
BEGIN
    IF NEW.event_slot_id IS NULL OR NEW.event_id IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT event_id INTO v_slot_event FROM event_slots WHERE id = NEW.event_slot_id;
    IF v_slot_event IS NULL THEN
        RAISE EXCEPTION '존재하지 않는 슬롯 ID: %', NEW.event_slot_id;
    END IF;
    IF v_slot_event <> NEW.event_id THEN
        RAISE EXCEPTION '슬롯(%)이 다른 이벤트(% vs %)에 속해 있어 신청할 수 없습니다.',
            NEW.event_slot_id, v_slot_event, NEW.event_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inquiries_slot_event_check ON inquiries;
CREATE TRIGGER inquiries_slot_event_check
    BEFORE INSERT OR UPDATE OF event_slot_id, event_id ON inquiries
    FOR EACH ROW
    EXECUTE FUNCTION inquiries_check_slot_event();

-- ============================================
-- 7. 기존 게스트 중복 신청 정리 (같은 phone + event + slot)
-- ============================================
-- 가장 먼저 신청한 행(min(created_at)) 1건만 유지, 나머지 삭제
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

-- ============================================
-- 8. 게스트 중복 신청 차단 — UNIQUE 인덱스
-- ============================================
DROP INDEX IF EXISTS uniq_inquiries_phone_event_slot;
CREATE UNIQUE INDEX uniq_inquiries_phone_event_slot
    ON inquiries (phone, event_id, event_slot_id)
    WHERE event_id IS NOT NULL AND event_slot_id IS NOT NULL AND phone IS NOT NULL;
