-- 1회차(event=3) 노을(slot=29)에 [member-E] 추가
-- 가입 시 이름란이 '[member-E] 입니다.'로 저장되어 있어 함께 정리

DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id
    FROM profiles
    WHERE name = '[member-E] 입니다.' OR name = '[member-E]'
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '[member-E]을 profiles에서 찾을 수 없습니다.';
    END IF;

    -- 이름 정리
    UPDATE profiles SET name = '[member-E]' WHERE id = v_user_id;
    RAISE NOTICE '이름 정리: [member-E]';

    -- 노을(29)에 신청
    IF EXISTS (SELECT 1 FROM attendance WHERE user_id = v_user_id AND event_id = 3) THEN
        UPDATE attendance SET event_slot_id = 29
        WHERE user_id = v_user_id AND event_id = 3;
        RAISE NOTICE '기존 1회차 신청 → 노을(29)로 슬롯 변경';
    ELSE
        INSERT INTO attendance (user_id, event_id, event_slot_id, note)
        VALUES (v_user_id, 3, 29, '관리자 수동 추가');
        RAISE NOTICE '1회차 노을(29) 신청 추가 완료';
    END IF;
END $$;
