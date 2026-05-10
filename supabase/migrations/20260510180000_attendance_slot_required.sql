-- 슬롯 선택 강제: attendance.event_slot_id NOT NULL
-- 기존 NULL row가 있으면 마이그레이션 실패하므로 사전 정리는 호출자가 보장한다.

-- attend_event RPC에서 NULL slot 거부
CREATE OR REPLACE FUNCTION attend_event(
    p_event_id INTEGER,
    p_event_slot_id INTEGER DEFAULT NULL,
    p_note TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF p_event_slot_id IS NULL THEN
        RAISE EXCEPTION '타임 슬롯을 먼저 선택해주세요.';
    END IF;

    INSERT INTO attendance (user_id, event_id, event_slot_id, note)
    VALUES (auth.uid(), p_event_id, p_event_slot_id, COALESCE(p_note, ''))
    ON CONFLICT ON CONSTRAINT attendance_user_event_slot_uniq DO NOTHING;
END;
$$;

-- 컬럼 자체에도 NOT NULL 강제 (NULL row 사전 정리 후 적용)
DO $$
BEGIN
    -- 기존 NULL row가 있다면 삭제하지 말고 그냥 컬럼 변경만 시도. 실패 시 운영자 정리 필요.
    IF EXISTS (SELECT 1 FROM attendance WHERE event_slot_id IS NULL) THEN
        RAISE NOTICE 'attendance에 event_slot_id IS NULL row 존재 — NOT NULL 변경 스킵';
    ELSE
        EXECUTE 'ALTER TABLE attendance ALTER COLUMN event_slot_id SET NOT NULL';
    END IF;
END
$$;
