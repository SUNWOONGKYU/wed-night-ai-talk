-- 1회차(event=3) 노을(29)에서 [member-D] 제거

DO $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM attendance a
    USING profiles p
    WHERE a.user_id = p.id
      AND a.event_id = 3
      AND p.name = '[member-D]';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[member-D] attendance 삭제: % 건', v_deleted;
END $$;
