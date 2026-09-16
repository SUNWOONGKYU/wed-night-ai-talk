-- 진행 방식(오프라인/온라인/병행) — 참가자들이 온·오프라인을 헷갈려 해서 명시 항목 추가 (PO, 2026-09-16).
-- 온라인 링크(Zoom 등)는 교안(event_handouts)과 같은 이유로 별도 테이블 + RLS(관리자·신청자만).
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS attendance_mode TEXT NOT NULL DEFAULT 'offline';

ALTER TABLE public.events
    DROP CONSTRAINT IF EXISTS events_attendance_mode_check;

ALTER TABLE public.events
    ADD CONSTRAINT events_attendance_mode_check
    CHECK (attendance_mode IN ('offline', 'online', 'hybrid'));

-- 유튜브 라이브 링크가 있던 기존 모임은 현장+온라인 병행이었다
UPDATE public.events
   SET attendance_mode = 'hybrid'
 WHERE youtube_url IS NOT NULL AND btrim(youtube_url) <> '' AND attendance_mode = 'offline';

CREATE TABLE IF NOT EXISTS public.event_online_links (
    event_id   INTEGER PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    url        TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_online_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.event_online_links FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_online_links TO authenticated;

DROP POLICY IF EXISTS event_online_links_select ON public.event_online_links;
CREATE POLICY event_online_links_select ON public.event_online_links
    FOR SELECT TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.attendance a
             WHERE a.event_id = event_online_links.event_id
               AND a.user_id  = auth.uid()
        )
    );

DROP POLICY IF EXISTS event_online_links_admin_write ON public.event_online_links;
CREATE POLICY event_online_links_admin_write ON public.event_online_links
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
