-- =============================================
-- 본인 요청에 의한 회원 탈퇴 처리 (2026-09-02, PO 승인)
-- =============================================
-- 회원 본인이 메일로 "Mailing list / 회원 리스트에서 삭제"를 요청했다.
-- 이 사이트에는 수신거부 기능이 없어 회원으로 남아 있으면 발송 대상
-- (js/admin.js getEmailRecipients → profiles 전체)에 계속 포함된다.
-- → PO 승인에 따라 계정을 완전히 삭제한다.
--
-- 대상은 UUID 로만 지정한다 — 실명·이메일은 이 파일에 남기지 않는다 (README PII 규칙).
-- 삭제 전 확인한 영향 범위: attendance 0건 · posts 0건 · comments 0건.
--   → 다른 회원에게 보이는 콘텐츠가 사라지는 부수효과는 없다.
--
-- profiles.id 는 auth.users(id) ON DELETE CASCADE 이므로 auth 계정을 지우면
-- 프로필·참석 기록이 함께 정리된다. 예비멤버처럼 auth 계정이 없는 행도 있을 수
-- 있어 profiles 쪽도 뒤이어 정리한다.
-- =============================================

DO $$
DECLARE
    v_id CONSTANT uuid := 'cf329888-12d5-47e4-ba46-25925e08ca3d';
    n_auth     integer;
    n_profile  integer;
BEGIN
    DELETE FROM auth.users WHERE id = v_id;
    GET DIAGNOSTICS n_auth = ROW_COUNT;

    DELETE FROM public.profiles WHERE id = v_id;
    GET DIAGNOSTICS n_profile = ROW_COUNT;

    RAISE NOTICE '[ok] 탈퇴 처리 — auth %행, profiles 잔여 %행 삭제', n_auth, n_profile;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_id) THEN
        RAISE EXCEPTION '삭제 실패: profiles 행이 남아 있습니다';
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 진단용 임시 조회 함수 제거 (20260902060000 에서 만든 것 — 남기지 않는다)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS _waat_tmp_member_lookup(text, text);
