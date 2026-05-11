-- 게스트 모임 신청을 별도 테이블로 분리
-- 1) guest_attendance 테이블 생성 + 트리거/RLS
-- 2) 기존 inquiries에서 event_id가 있는 행을 guest_attendance로 복사
-- 3) attend_event RPC + inquiries 트리거의 capacity 계산을 guest_attendance 합산으로 갱신
-- 4) inquiries에서 모임 참여 행(event_id NOT NULL) 삭제

-- ============================================
-- 1. guest_attendance 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS guest_attendance (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    message TEXT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    event_slot_id INTEGER NOT NULL REFERENCES event_slots(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_attendance_event ON guest_attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_attendance_slot ON guest_attendance(event_slot_id);

-- 중복 신청 차단 (phone + event + slot)
DROP INDEX IF EXISTS uniq_guest_attendance_phone_event_slot;
CREATE UNIQUE INDEX uniq_guest_attendance_phone_event_slot
    ON guest_attendance (phone, event_id, event_slot_id);

-- ============================================
-- 2. RLS 정책
-- ============================================
ALTER TABLE guest_attendance ENABLE ROW LEVEL SECURITY;

-- anon/authenticated INSERT 허용 (게스트 신청)
DROP POLICY IF EXISTS guest_attendance_insert_anyone ON guest_attendance;
CREATE POLICY guest_attendance_insert_anyone ON guest_attendance
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- admin SELECT 전용
DROP POLICY IF EXISTS guest_attendance_select_admin ON guest_attendance;
CREATE POLICY guest_attendance_select_admin ON guest_attendance
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin'
        )
    );

-- admin DELETE
DROP POLICY IF EXISTS guest_attendance_delete_admin ON guest_attendance;
CREATE POLICY guest_attendance_delete_admin ON guest_attendance
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin'
        )
    );

-- 참석자 명단 조회용 — 비로그인도 슬롯별 카운트만 셀 수 있도록 별도 RPC로 처리 (아래 5번)

-- ============================================
-- 3. 트리거: cross-event 슬롯 참조 차단
-- ============================================
CREATE OR REPLACE FUNCTION guest_attendance_check_slot_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_slot_event INTEGER;
BEGIN
    SELECT event_id INTO v_slot_event FROM event_slots WHERE id = NEW.event_slot_id;
    IF v_slot_event IS NULL THEN
        RAISE EXCEPTION '존재하지 않는 슬롯 ID: %', NEW.event_slot_id;
    END IF;
    IF v_slot_event <> NEW.event_id THEN
        RAISE EXCEPTION '슬롯(%)이 다른 이벤트(% vs %)에 속해 있어 신청할 수 없습니다.',
            NEW.event_slot_id, v_slot_event, NEW.event_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guest_attendance_slot_event_check ON guest_attendance;
CREATE TRIGGER guest_attendance_slot_event_check
    BEFORE INSERT OR UPDATE OF event_slot_id, event_id ON guest_attendance
    FOR EACH ROW
    EXECUTE FUNCTION guest_attendance_check_slot_event();

-- ============================================
-- 4. 트리거: capacity 체크 (attendance + guest_attendance 합산)
-- ============================================
CREATE OR REPLACE FUNCTION guest_attendance_check_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cap INTEGER;
    v_taken INTEGER;
BEGIN
    SELECT COALESCE(es.capacity, ev.capacity, 20) INTO v_cap
    FROM event_slots es
    JOIN events ev ON ev.id = es.event_id
    WHERE es.id = NEW.event_slot_id;

    IF v_cap IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT
        COALESCE((SELECT COUNT(*) FROM attendance a WHERE a.event_slot_id = NEW.event_slot_id), 0)
      + COALESCE((SELECT COUNT(*) FROM guest_attendance g WHERE g.event_slot_id = NEW.event_slot_id), 0)
    INTO v_taken;

    IF v_taken >= v_cap THEN
        RAISE EXCEPTION '해당 시간대는 마감되었습니다. 다른 시간대를 선택해주세요. (정원 %명)', v_cap;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guest_attendance_capacity_check ON guest_attendance;
CREATE TRIGGER guest_attendance_capacity_check
    BEFORE INSERT ON guest_attendance
    FOR EACH ROW
    EXECUTE FUNCTION guest_attendance_check_capacity();

-- ============================================
-- 5. attend_event RPC 갱신 (capacity 계산을 새 테이블 기준으로)
-- ============================================
CREATE OR REPLACE FUNCTION attend_event(
    p_event_id INTEGER,
    p_event_slot_id INTEGER DEFAULT NULL,
    p_note TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cap INTEGER;
    v_taken INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF p_event_slot_id IS NULL THEN
        RAISE EXCEPTION '타임 슬롯을 먼저 선택해주세요.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM attendance
        WHERE user_id = auth.uid() AND event_id = p_event_id AND event_slot_id = p_event_slot_id
    ) THEN
        RETURN;
    END IF;

    SELECT COALESCE(es.capacity, ev.capacity, 20) INTO v_cap
    FROM event_slots es
    JOIN events ev ON ev.id = es.event_id
    WHERE es.id = p_event_slot_id;

    SELECT
        COALESCE((SELECT COUNT(*) FROM attendance a WHERE a.event_slot_id = p_event_slot_id), 0)
      + COALESCE((SELECT COUNT(*) FROM guest_attendance g WHERE g.event_slot_id = p_event_slot_id), 0)
    INTO v_taken;

    IF v_taken >= v_cap THEN
        RAISE EXCEPTION '해당 시간대는 마감되었습니다. 다른 시간대를 선택해주세요. (정원 %명)', v_cap;
    END IF;

    INSERT INTO attendance (user_id, event_id, event_slot_id, note)
    VALUES (auth.uid(), p_event_id, p_event_slot_id, COALESCE(p_note, ''))
    ON CONFLICT ON CONSTRAINT attendance_user_event_slot_uniq DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION attend_event(INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION attend_event(INTEGER, INTEGER, TEXT) TO authenticated;

-- ============================================
-- 6. 게스트 신청 RPC (anon 호출용) — RLS와 트리거로 안전
-- ============================================
CREATE OR REPLACE FUNCTION create_guest_attendance(
    p_name TEXT,
    p_phone TEXT,
    p_email TEXT,
    p_message TEXT,
    p_event_id INTEGER,
    p_event_slot_id INTEGER
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id BIGINT;
BEGIN
    IF p_phone IS NULL OR length(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 10 THEN
        RAISE EXCEPTION '핸드폰 번호를 정확히 입력해주세요.';
    END IF;
    IF p_event_slot_id IS NULL THEN
        RAISE EXCEPTION '타임 슬롯을 선택해주세요.';
    END IF;

    INSERT INTO guest_attendance (name, phone, email, message, event_id, event_slot_id)
    VALUES (p_name, regexp_replace(p_phone, '[^0-9]', '', 'g'), p_email, p_message, p_event_id, p_event_slot_id)
    RETURNING id INTO v_id;

    RETURN v_id;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION '이미 같은 핸드폰 번호로 신청되어 있습니다.';
END;
$$;

REVOKE ALL ON FUNCTION create_guest_attendance(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_guest_attendance(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;

-- ============================================
-- 7. 슬롯별 점유 카운트 RPC (anon 호출용) — 마감 표시용
-- ============================================
CREATE OR REPLACE FUNCTION get_slot_taken_counts(p_event_id INTEGER)
RETURNS TABLE(event_slot_id INTEGER, taken INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        es.id AS event_slot_id,
        (COALESCE((SELECT COUNT(*) FROM attendance a WHERE a.event_slot_id = es.id), 0)
       + COALESCE((SELECT COUNT(*) FROM guest_attendance g WHERE g.event_slot_id = es.id), 0))::INTEGER AS taken
    FROM event_slots es
    WHERE es.event_id = p_event_id;
$$;

GRANT EXECUTE ON FUNCTION get_slot_taken_counts(INTEGER) TO anon, authenticated;

-- ============================================
-- 8. 기존 inquiries의 모임 참여 행 → guest_attendance로 이관
-- ============================================
INSERT INTO guest_attendance (name, phone, email, message, event_id, event_slot_id, created_at)
SELECT
    COALESCE(name, '(이름 미상)'),
    COALESCE(regexp_replace(phone, '[^0-9]', '', 'g'), ''),
    email,
    message,
    event_id,
    event_slot_id,
    created_at
FROM inquiries
WHERE event_id IS NOT NULL
  AND event_slot_id IS NOT NULL
  AND phone IS NOT NULL
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 10
ON CONFLICT (phone, event_id, event_slot_id) DO NOTHING;

-- ============================================
-- 9. 이관된 inquiries 행 삭제 (모임 참여 신청만)
-- ============================================
DELETE FROM inquiries
WHERE event_id IS NOT NULL
  AND event_slot_id IS NOT NULL;

-- ============================================
-- 10. inquiries 트리거 무력화 — 이제 inquiries는 일반 문의 전용
-- ============================================
DROP TRIGGER IF EXISTS inquiries_capacity_check ON inquiries;
DROP TRIGGER IF EXISTS inquiries_slot_event_check ON inquiries;

-- UNIQUE 인덱스도 제거 (일반 문의는 중복 허용)
DROP INDEX IF EXISTS uniq_inquiries_phone_event_slot;
