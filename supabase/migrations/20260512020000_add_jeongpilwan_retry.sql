-- [member-E] 노을(29) 추가 재시도
-- 이전 20260512010000 이 history에 기록만 되고 실행 안 된 것으로 확인됨
-- (profile 이름이 '[member-E] 입니다.' 그대로 + attendance 미존재)

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

    -- 노을(29)에 신청
    IF EXISTS (SELECT 1 FROM attendance WHERE user_id = v_user_id AND event_id = 3) THEN
        UPDATE attendance SET event_slot_id = 29
        WHERE user_id = v_user_id AND event_id = 3;
    ELSE
        INSERT INTO attendance (user_id, event_id, event_slot_id, note)
        VALUES (v_user_id, 3, 29, '관리자 수동 추가');
    END IF;
END $$;
