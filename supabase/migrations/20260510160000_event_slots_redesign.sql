-- ========================================
-- WAAT 슬롯 데이터 모델 재설계
-- 1) event_slots 자식 테이블 신설
-- 2) 디폴트 3슬롯 자동 시드 (기존 모임에)
-- 3) attendance/inquiries.slot_id (TEXT) → event_slot_id (FK) 마이그레이션
-- 4) events.provision, event_time 컬럼 drop
-- 5) RPC 시그니처 갱신 (attend_event, cancel_attendance, get_slot_counts)
-- ========================================

-- ---------- 1. event_slots ----------
CREATE TABLE IF NOT EXISTS event_slots (
    id           SERIAL PRIMARY KEY,
    event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    slot_label   TEXT NOT NULL,
    slot_emoji   TEXT,
    slot_time    TIME,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_slots_event ON event_slots(event_id, sort_order);

-- RLS: 모두 SELECT 가능, 수정은 admin만 (admin email 체크)
ALTER TABLE event_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_slots_read ON event_slots;
CREATE POLICY event_slots_read ON event_slots
    FOR SELECT USING (true);

DROP POLICY IF EXISTS event_slots_admin_write ON event_slots;
CREATE POLICY event_slots_admin_write ON event_slots
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email IN ('wksun999@gmail.com', 'lsonic.lee@gmail.com'))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email IN ('wksun999@gmail.com', 'lsonic.lee@gmail.com'))
    );

-- ---------- 2. 디폴트 3슬롯 시드 (기존 events 대상) ----------
INSERT INTO event_slots (event_id, slot_label, slot_emoji, slot_time, sort_order)
SELECT e.id, '햇살', '☀️', '13:00'::time, 1 FROM events e
    WHERE NOT EXISTS (SELECT 1 FROM event_slots s WHERE s.event_id = e.id);

INSERT INTO event_slots (event_id, slot_label, slot_emoji, slot_time, sort_order)
SELECT e.id, '노을', '🌅', '16:00'::time, 2 FROM events e
    WHERE NOT EXISTS (SELECT 1 FROM event_slots s WHERE s.event_id = e.id AND s.slot_label = '노을');

INSERT INTO event_slots (event_id, slot_label, slot_emoji, slot_time, sort_order)
SELECT e.id, '달빛', '🌙', '19:00'::time, 3 FROM events e
    WHERE NOT EXISTS (SELECT 1 FROM event_slots s WHERE s.event_id = e.id AND s.slot_label = '달빛');

-- ---------- 3. attendance: event_slot_id 추가 + 데이터 이전 ----------
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS event_slot_id INTEGER REFERENCES event_slots(id) ON DELETE CASCADE;

-- 기존 slot_id (TEXT) → event_slot_id 매핑
UPDATE attendance a
SET event_slot_id = es.id
FROM event_slots es
WHERE es.event_id = a.event_id
  AND a.event_slot_id IS NULL
  AND (
      (a.slot_id = 'sun'  AND es.slot_label = '햇살') OR
      (a.slot_id = 'dusk' AND es.slot_label = '노을') OR
      (a.slot_id = 'moon' AND es.slot_label = '달빛')
  );

-- 옛 unique 제약 제거 (slot_id 기반)
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_user_event_slot_uniq;

-- 새 unique 제약 (event_slot_id 기반)
ALTER TABLE attendance ADD CONSTRAINT attendance_user_event_slot_uniq
    UNIQUE NULLS NOT DISTINCT (user_id, event_id, event_slot_id);

-- slot_id 컬럼 drop
ALTER TABLE attendance DROP COLUMN IF EXISTS slot_id;

-- ---------- 4. inquiries: event_slot_id 추가 + 데이터 이전 ----------
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS event_slot_id INTEGER REFERENCES event_slots(id) ON DELETE SET NULL;

UPDATE inquiries i
SET event_slot_id = es.id
FROM event_slots es
WHERE es.event_id = i.event_id
  AND i.event_slot_id IS NULL
  AND (
      (i.slot_id = 'sun'  AND es.slot_label = '햇살') OR
      (i.slot_id = 'dusk' AND es.slot_label = '노을') OR
      (i.slot_id = 'moon' AND es.slot_label = '달빛')
  );

ALTER TABLE inquiries DROP COLUMN IF EXISTS slot_id;

-- ---------- 5. events 옛 컬럼 정리 ----------
ALTER TABLE events DROP COLUMN IF EXISTS provision;
ALTER TABLE events DROP COLUMN IF EXISTS event_time;

-- ---------- 6. RPC 갱신 ----------

-- 6.1 attend_event: 회원 참여 (p_event_slot_id 사용)
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

    INSERT INTO attendance (user_id, event_id, event_slot_id, note)
    VALUES (auth.uid(), p_event_id, p_event_slot_id, COALESCE(p_note, ''))
    ON CONFLICT ON CONSTRAINT attendance_user_event_slot_uniq DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION attend_event(INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION attend_event(INTEGER, INTEGER, TEXT) TO authenticated;

-- 6.2 cancel_attendance: 회원 취소
CREATE OR REPLACE FUNCTION cancel_attendance(
    p_event_id INTEGER,
    p_event_slot_id INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    DELETE FROM attendance
    WHERE user_id = auth.uid()
      AND event_id = p_event_id
      AND event_slot_id IS NOT DISTINCT FROM p_event_slot_id;
END;
$$;

REVOKE ALL ON FUNCTION cancel_attendance(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_attendance(INTEGER, INTEGER) TO authenticated;

-- 6.3 get_slot_counts: event_slot_id 기준 회원/게스트 수 집계
DROP FUNCTION IF EXISTS get_slot_counts(INTEGER);

CREATE OR REPLACE FUNCTION get_slot_counts(p_event_id INTEGER)
RETURNS TABLE(
    event_slot_id INTEGER,
    slot_label TEXT,
    slot_emoji TEXT,
    slot_time TIME,
    sort_order INTEGER,
    is_active BOOLEAN,
    member_count BIGINT,
    guest_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        es.id AS event_slot_id,
        es.slot_label,
        es.slot_emoji,
        es.slot_time,
        es.sort_order,
        es.is_active,
        COALESCE((SELECT COUNT(*) FROM attendance a WHERE a.event_id = p_event_id AND a.event_slot_id = es.id), 0) AS member_count,
        COALESCE((SELECT COUNT(*) FROM inquiries i WHERE i.event_id = p_event_id AND i.event_slot_id = es.id), 0) AS guest_count
    FROM event_slots es
    WHERE es.event_id = p_event_id
      AND es.is_active = TRUE
    ORDER BY es.sort_order, es.id;
$$;

REVOKE ALL ON FUNCTION get_slot_counts(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_slot_counts(INTEGER) TO anon, authenticated;

-- ---------- 7. 인덱스 ----------
DROP INDEX IF EXISTS idx_attendance_event_slot;
CREATE INDEX IF NOT EXISTS idx_attendance_event_slot_id ON attendance(event_id, event_slot_id);

DROP INDEX IF EXISTS idx_inquiries_event_slot;
CREATE INDEX IF NOT EXISTS idx_inquiries_event_slot_id ON inquiries(event_id, event_slot_id);
