-- 1회차(event=3) 달빛(slot=6)에 선웅규 추가

DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id
    FROM profiles
    WHERE name = '선웅규'
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '선웅규를 profiles에서 찾을 수 없습니다.';
    END IF;

    IF EXISTS (SELECT 1 FROM attendance WHERE user_id = v_user_id AND event_id = 3) THEN
        UPDATE attendance SET event_slot_id = 6
        WHERE user_id = v_user_id AND event_id = 3;
    ELSE
        INSERT INTO attendance (user_id, event_id, event_slot_id, note)
        VALUES (v_user_id, 3, 6, '관리자 수동 추가');
    END IF;
END $$;
