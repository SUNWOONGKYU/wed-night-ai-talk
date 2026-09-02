-- =============================================
-- attendance 익명 직접조회 차단 (PO 승인, 2026-09-02)
-- =============================================
-- 확인된 사실 (익명 REST 요청으로 프로덕션 실측)
--   · GET /rest/v1/attendance?select=*  →  206, Content-Range: 0-0/70
--     즉 익명이 과거 회차 포함 참석 기록 70행을 전부 읽을 수 있다.
--     노출 항목: user_id · event_id · event_slot_id · note · created_at(초 단위 신청시각)
--   · user_id 는 UUID 지만, 게시판 글쓴이 표시를 위해 열어둔 profiles(id, name) 과
--     조인하면 실명까지 붙는다.
--
-- 이 정책은 저장소 어디에도 없다 — schema.sql 이 선언한 attendance SELECT 정책은
--   ① "Users can view own attendance"  (auth.uid() = user_id)
--   ② "Admins can view all attendance"
-- 둘뿐이다. 익명이 읽힌다는 건 대시보드에서 만든 USING(true) 정책이 따로 있거나
-- RLS 가 꺼져 있다는 뜻이다 (profiles 때와 동일한 드리프트).
--
-- 화면은 영향 없다 — 신청자 명단은 get_slot_attendees(), 인원수는 get_slot_counts() 로
-- 표시하는데 둘 다 SECURITY DEFINER 라 RLS 를 우회한다. 즉 '공개하기로 한 것'
-- (현재 활성 모임의 신청자 이름)은 그대로 나가고, 공개한 적 없는 것(지난 회차 이력·
-- 신청 시각·note)만 닫힌다.
--
-- 남기는 접근 경로
--   · 본인 신청 조회 (js/supabase-config.js getMyAttendance) → authenticated, 본인 행만
--   · 관리자 신청자 명단 (js/admin.js getEventAttendees)     → authenticated + 관리자
-- =============================================

-- ---------------------------------------------------------------------------
-- 1) RLS 가 꺼져 있으면 켠다 (꺼져 있으면 정책을 아무리 만들어도 무의미)
-- ---------------------------------------------------------------------------
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2) '누구나' SELECT 정책 제거
--    이름을 모르므로(드리프트라 저장소에 없다) 조건으로 찾아서 지운다.
--    대상: SELECT 정책 중 USING 절이 없거나 true 인 것.
--    지운 이름은 NOTICE 로 남긴다 — 무엇을 지웠는지 기록이 남아야 한다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
    n INT := 0;
BEGIN
    FOR r IN
        SELECT policyname, qual, roles
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'attendance'
          AND cmd IN ('SELECT', 'ALL')
          AND (qual IS NULL OR btrim(qual) = 'true')
    LOOP
        RAISE NOTICE '[drop] attendance 정책 제거: % (cmd=SELECT/ALL, roles=%, qual=%)',
                     r.policyname, r.roles, COALESCE(r.qual, '(none)');
        EXECUTE format('DROP POLICY %I ON public.attendance', r.policyname);
        n := n + 1;
    END LOOP;

    IF n = 0 THEN
        RAISE NOTICE '[info] 제거할 USING(true) SELECT 정책 없음 — 노출 원인은 RLS 미적용이었을 가능성';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) 정당한 조회 경로 두 개를 명시적으로 (재)선언
-- ---------------------------------------------------------------------------

-- 3-1) 본인 신청 조회
DROP POLICY IF EXISTS attendance_select_own ON public.attendance;
CREATE POLICY attendance_select_own ON public.attendance
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- 3-2) 관리자 전체 조회
--   schema.sql 의 기존 관리자 정책은 profiles.role = 'admin' 을 참조한다.
--   그 경로가 실제로 서는지(해당 계정의 role 값이 'admin' 인지)는 저장소만 봐선 알 수 없어,
--   나머지 관리자 정책들과 동일한 is_admin()(JWT 이메일 기반, SECURITY DEFINER) 정책을
--   추가로 건다. 둘은 permissive 라 OR 로 합쳐지므로 기존 경로를 깨지 않는다.
DROP POLICY IF EXISTS attendance_select_admin ON public.attendance;
CREATE POLICY attendance_select_admin ON public.attendance
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4) anon 역할의 테이블 권한 회수 (이중 방어)
--    정책이 또 잘못 열려도 grant 가 없으면 anon 은 읽지 못한다.
--    SELECT 만 회수한다 — 다른 권한은 건드리지 않는다.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON public.attendance FROM anon;
