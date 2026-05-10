-- 2026-05-10: 3 타임 슬롯(햇살/노을/달빛) 신청 지원을 위한 스키마 보강
-- 1) attendance: slot_id 컬럼 추가, UNIQUE 제약 변경 (user_id, event_id) → (user_id, event_id, slot_id)
-- 2) inquiries: slot_id, event_id 컬럼 추가 (게스트 신청용)
-- 3) attend_event RPC: slot_id 파라미터 추가
-- 4) 슬롯별 집계용 인덱스

-- ========================================
-- 1. attendance 테이블
-- ========================================
ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS slot_id TEXT
    CHECK (slot_id IN ('sun', 'dusk', 'moon'));

-- 기존 UNIQUE(user_id, event_id) 제약 해제
ALTER TABLE attendance
    DROP CONSTRAINT IF EXISTS attendance_user_id_event_id_key;

-- 새 UNIQUE: 한 회원이 같은 모임에 여러 슬롯 신청 가능, 같은 슬롯은 1회만
-- NULLS NOT DISTINCT: 기존 NULL 슬롯끼리도 중복 차단 (PG 15+)
ALTER TABLE attendance
    ADD CONSTRAINT attendance_user_event_slot_uniq
    UNIQUE NULLS NOT DISTINCT (user_id, event_id, slot_id);

-- ========================================
-- 2. inquiries 테이블 (게스트 신청용 컬럼 추가)
-- ========================================
ALTER TABLE inquiries
    ADD COLUMN IF NOT EXISTS slot_id TEXT
    CHECK (slot_id IN ('sun', 'dusk', 'moon'));

ALTER TABLE inquiries
    ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES events(id) ON DELETE SET NULL;

-- ========================================
-- 3. attend_event RPC: slot_id 파라미터 추가
-- ========================================
CREATE OR REPLACE FUNCTION attend_event(
    p_event_id INTEGER,
    p_slot_id  TEXT DEFAULT NULL,
    p_note     TEXT DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    IF p_slot_id IS NOT NULL AND p_slot_id NOT IN ('sun', 'dusk', 'moon') THEN
        RAISE EXCEPTION '유효하지 않은 슬롯 ID: %', p_slot_id;
    END IF;

    INSERT INTO attendance (user_id, event_id, slot_id, note)
    VALUES (auth.uid(), p_event_id, p_slot_id, COALESCE(p_note, ''))
    ON CONFLICT (user_id, event_id, slot_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION attend_event(INTEGER, TEXT, TEXT) TO authenticated;

-- ========================================
-- 4. 인덱스 (슬롯별 집계 최적화)
-- ========================================
CREATE INDEX IF NOT EXISTS idx_attendance_event_slot
    ON attendance(event_id, slot_id);

CREATE INDEX IF NOT EXISTS idx_inquiries_event_slot
    ON inquiries(event_id, slot_id);
