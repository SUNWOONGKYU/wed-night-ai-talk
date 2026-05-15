-- 1회차(event_id=3) 햇살(slot_id=28) — [member-C] 삭제
-- 회원(attendance) + 게스트(inquiries) 양쪽 점검

DO $$
DECLARE
    member_count INTEGER;
    guest_count INTEGER;
    target_name TEXT := '[member-C]';
BEGIN
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
        RAISE NOTICE '[%] 회원 % 건 삭제', target_name, member_count;
    END IF;

    SELECT COUNT(*) INTO guest_count
    FROM inquiries
    WHERE event_id = 3 AND event_slot_id = 28 AND name = target_name;

    RAISE NOTICE '[%] 게스트 매칭: % 건', target_name, guest_count;

    IF guest_count > 0 THEN
        DELETE FROM inquiries
        WHERE event_id = 3 AND event_slot_id = 28 AND name = target_name;
        RAISE NOTICE '[%] 게스트 % 건 삭제', target_name, guest_count;
    END IF;

    IF member_count = 0 AND guest_count = 0 THEN
        RAISE NOTICE '[%] 매칭 없음 — skip', target_name;
    END IF;
END $$;
