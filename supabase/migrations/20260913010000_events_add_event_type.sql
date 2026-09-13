-- 행사(Event) 메뉴 신설 — 강의(Lecture) 등록용.
--
-- 1) events.event_type: 'meeting' = 기존 수요일 모임(#schedule), 'event' = 행사(#event).
--    기존 행은 전부 모임이므로 DEFAULT 'meeting'으로 채워진다.
--    회차 번호("제N회 모임")는 event_type별로 따로 세므로 행사가 끼어도 모임 번호는 밀리지 않는다.
-- 2) 강의 전용 컬럼 (모임 행은 NULL): 강사 3필드·커리큘럼·수강 대상·준비물·수강료·입금 안내·신청 마감일.
-- 3) event_handouts: 교안 URL. 유료 강의라 events 본문에 두면 익명 SELECT 정책으로 새어 나가므로
--    별도 테이블 + RLS(관리자 또는 해당 강의 신청자만)로 분리한다.
-- 4) attend_event: 신청 마감일(KST 기준, 당일 포함)이 지나면 서버에서 거부.
--    (프론트 버튼 잠금은 우회 가능하므로 RPC에서 한 번 더 막는다)

-- ---------------------------------------------------------------------------
-- 1) 종류
-- ---------------------------------------------------------------------------
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'meeting';

ALTER TABLE public.events
    DROP CONSTRAINT IF EXISTS events_event_type_check;

ALTER TABLE public.events
    ADD CONSTRAINT events_event_type_check
    CHECK (event_type IN ('meeting', 'event'));

CREATE INDEX IF NOT EXISTS events_type_active_date_idx
    ON public.events (event_type, is_active, event_date);

-- ---------------------------------------------------------------------------
-- 2) 강의 전용 컬럼
-- ---------------------------------------------------------------------------
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS instructor_name  TEXT,
    ADD COLUMN IF NOT EXISTS instructor_title TEXT,   -- 소속/직함
    ADD COLUMN IF NOT EXISTS instructor_bio   TEXT,   -- 한 줄 소개
    ADD COLUMN IF NOT EXISTS curriculum       TEXT,   -- 줄 단위 목차
    ADD COLUMN IF NOT EXISTS audience         TEXT,   -- 수강 대상·난이도
    ADD COLUMN IF NOT EXISTS materials        TEXT,   -- 준비물
    ADD COLUMN IF NOT EXISTS fee              TEXT,   -- 수강료 (표시용 문자열)
    ADD COLUMN IF NOT EXISTS payment_info     TEXT,   -- 입금 안내
    ADD COLUMN IF NOT EXISTS apply_deadline   DATE;   -- 신청 마감일 (당일 포함)

-- ---------------------------------------------------------------------------
-- 3) 교안 URL — 신청자·관리자만
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_handouts (
    event_id   INTEGER PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    url        TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_handouts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.event_handouts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_handouts TO authenticated;

DROP POLICY IF EXISTS event_handouts_select ON public.event_handouts;
CREATE POLICY event_handouts_select ON public.event_handouts
    FOR SELECT TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.attendance a
             WHERE a.event_id = event_handouts.event_id
               AND a.user_id  = auth.uid()
        )
    );

DROP POLICY IF EXISTS event_handouts_admin_write ON public.event_handouts;
CREATE POLICY event_handouts_admin_write ON public.event_handouts
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4) attend_event — 신청 마감일 서버 검증 추가
--    (본문은 20260511230000_split_guest_attendance.sql 버전 + 마감 체크 한 블록)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attend_event(
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
    v_deadline DATE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF p_event_slot_id IS NULL THEN
        RAISE EXCEPTION '타임 슬롯을 먼저 선택해주세요.';
    END IF;

    -- 신청 마감일 (KST 당일까지 허용)
    SELECT apply_deadline INTO v_deadline FROM events WHERE id = p_event_id;
    IF v_deadline IS NOT NULL AND (now() AT TIME ZONE 'Asia/Seoul')::date > v_deadline THEN
        RAISE EXCEPTION '신청이 마감되었습니다. (마감일 %)', to_char(v_deadline, 'YYYY-MM-DD');
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

REVOKE ALL ON FUNCTION public.attend_event(INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attend_event(INTEGER, INTEGER, TEXT) TO authenticated;
