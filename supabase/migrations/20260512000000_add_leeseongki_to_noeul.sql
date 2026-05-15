-- 1회차(event=3) 노을(slot=29)에 [member-D](구글 가입 회원) 추가
-- 안전장치: profiles에서 '[member-D]' 매칭 건수 NOTICE로 확인 후 추가

DO $$
DECLARE
    v_user_id UUID;
    v_match_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_match_count
    FROM profiles
    WHERE name = '[member-D]';

    RAISE NOTICE '[member-D] 매칭 profiles: % 건', v_match_count;

    IF v_match_count = 0 THEN
        RAISE EXCEPTION '[member-D]를 profiles에서 찾을 수 없습니다.';
    ELSIF v_match_count > 1 THEN
        -- 여러 명 있으면 가장 최근에 가입한 사람 사용 (구글 가입자)
        SELECT id INTO v_user_id
        FROM profiles
        WHERE name = '[member-D]'
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1;
        RAISE NOTICE '동명이인 발견 — 가장 최근 가입자 사용: %', v_user_id;
    ELSE
        SELECT id INTO v_user_id FROM profiles WHERE name = '[member-D]';
    END IF;

    -- 이미 1회차 등록되어 있으면 슬롯만 노을로 변경
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
