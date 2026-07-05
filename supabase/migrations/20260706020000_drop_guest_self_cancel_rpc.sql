-- =============================================
-- 게스트 셀프취소 RPC 2종 제거 - 2026-07-06
-- =============================================
-- 배경: 게스트 신청 UI/JS 완전 제거(2026-07-06) 후에도 이름+휴대폰 매칭 RPC가
-- anon/authenticated에 EXECUTE 권한이 남아있어, UI 없이도 직접 RPC 호출로
-- PII(이름+휴대폰) 조회·삭제가 가능한 상태였음(_audit/감사이력.md 지적).
-- 클라이언트 참조 0건 확인 후 서버측 함수 완전 제거.
-- =============================================

DROP FUNCTION IF EXISTS find_guest_attendances(TEXT, TEXT);
DROP FUNCTION IF EXISTS cancel_guest_attendance_by_owner(BIGINT, TEXT, TEXT);
