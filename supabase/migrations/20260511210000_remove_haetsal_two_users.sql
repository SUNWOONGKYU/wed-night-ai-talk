-- 1회차(event_id=3) 햇살(slot_id=28) — 이강준, 김경준 삭제
-- 회원(attendance) + 게스트(inquiries) 양쪽 모두 점검
-- 안전장치: 각 이름당 매칭 건수를 NOTICE로 알리고, 발견된 모든 행 삭제

DO $$
DECLARE
    member_count INTEGER;
    guest_count INTEGER;
    target_name TEXT;
    target_names TEXT[] := ARRAY['이강준', '김경준'];
BEGIN
    FOREACH target_name IN ARRAY target_names LOOP
        -- 회원 attendance 조회 후 삭제
        SELECT COUNT(*) INTO member_count
        FROM attendance a
        JOIN profiles p ON p.id = a.user_id
        WHERE a.event_id = 3 AND a.event_slot_id = 28 AND p.name = target_name;

        RAISE NOTICE '[%] 회원 매칭: % 건', target_name, member_count;

        IF member_count > 0 THEN
            DELETE FROM attendance
            WHERE id IN (
                SELECT a.id
                FROM attendance a
                JOIN profiles p ON p.id = a.user_id
                WHERE a.event_id = 3 AND a.event_slot_id = 28 AND p.name = target_name
            );
            RAISE NOTICE '[%] 회원 % 건 삭제 완료', target_name, member_count;
        END IF;

        -- 게스트 inquiries 조회 후 삭제
        SELECT COUNT(*) INTO guest_count
        FROM inquiries
        WHERE event_id = 3 AND event_slot_id = 28 AND name = target_name;

        RAISE NOTICE '[%] 게스트 매칭: % 건', target_name, guest_count;

        IF guest_count > 0 THEN
            DELETE FROM inquiries
            WHERE event_id = 3 AND event_slot_id = 28 AND name = target_name;
            RAISE NOTICE '[%] 게스트 % 건 삭제 완료', target_name, guest_count;
        END IF;

        IF member_count = 0 AND guest_count = 0 THEN
            RAISE NOTICE '[%] 매칭 행 없음 — skip', target_name;
        END IF;
    END LOOP;
END $$;
