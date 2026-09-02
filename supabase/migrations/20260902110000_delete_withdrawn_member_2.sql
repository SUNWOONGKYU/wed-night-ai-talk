-- =============================================
-- 본인 요청에 의한 회원 탈퇴 처리 2 (2026-09-02, PO 승인)
-- =============================================
-- 회원 본인이 메일로 "메일 중단"을 요청했다. 이 사이트에는 수신거부 기능이 없어
-- (발송 대상 = profiles 전체) 회원으로 남아 있으면 메일이 계속 나간다.
-- PO 판단에 따라 계정을 삭제한다.
--   ※ 본인이 요청한 것은 '메일 중단'이며 탈퇴까지는 요청하지 않았다는 점을
--     PO 에게 알렸고, 그럼에도 삭제로 진행하라는 지시를 받았다. 기록으로 남긴다.
--
-- 대상은 UUID 로만 지정한다 — 실명·이메일은 이 파일에 남기지 않는다 (README PII 규칙).
-- 삭제 전 확인한 영향 범위: attendance 0건 · posts 0건 · comments 0건.
-- 이 행은 로그인 계정이 없는 예비멤버 행이라(auth.users 에 대응 행 없음)
-- profiles 를 직접 지워야 한다.
-- =============================================

DO $$
DECLARE
    v_id CONSTANT uuid := '1b472934-de91-4009-aeb5-b3e7eeb0f4ce';
    n_auth    integer;
    n_profile integer;
BEGIN
    DELETE FROM auth.users WHERE id = v_id;
    GET DIAGNOSTICS n_auth = ROW_COUNT;

    DELETE FROM public.profiles WHERE id = v_id;
    GET DIAGNOSTICS n_profile = ROW_COUNT;

    RAISE NOTICE '[ok] 탈퇴 처리 — auth %행, profiles %행 삭제', n_auth, n_profile;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_id) THEN
        RAISE EXCEPTION '삭제 실패: profiles 행이 남아 있습니다';
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 진단용 임시 조회 함수 제거 (20260902100000 에서 만든 것 — 남기지 않는다)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS _waat_tmp_member_lookup(text, text);
