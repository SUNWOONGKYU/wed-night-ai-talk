-- 1회차(event=3) 달빛(slot=6): 선웅규 삭제 + [member-H] 추가
-- 단일 트랜잭션으로 처리하여 정원 트리거 통과 보장 (먼저 DELETE → INSERT)

DO $$
DECLARE
    v_seon UUID := '3ed90e6e-94d1-42c0-b349-db9f7b504b12';  -- 선웅규
    v_sim  UUID := 'fd9d42dd-4aeb-43aa-905e-df97cb7656e5';  -- [member-H]
    v_deleted INTEGER;
BEGIN
    -- 선웅규 1회차 신청 삭제
    DELETE FROM attendance
    WHERE user_id = v_seon AND event_id = 3;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '선웅규 1회차 신청 % 건 삭제', v_deleted;

    -- [member-H] 1회차 달빛(6) 신청
    IF EXISTS (SELECT 1 FROM attendance WHERE user_id = v_sim AND event_id = 3) THEN
        UPDATE attendance SET event_slot_id = 6
        WHERE user_id = v_sim AND event_id = 3;
        RAISE NOTICE '[member-H] 기존 1회차 신청 → 달빛(6)로 슬롯 변경';
    ELSE
        INSERT INTO attendance (user_id, event_id, event_slot_id, note)
        VALUES (v_sim, 3, 6, '관리자 수동 추가');
        RAISE NOTICE '[member-H] 1회차 달빛(6) 신청 추가 완료';
    END IF;
END $$;
