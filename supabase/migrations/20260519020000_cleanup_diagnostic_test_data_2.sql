-- =============================================
-- 글 등록 진단(크롬/Edge 재현) 테스트 데이터 2차 정리 - 2026-05-19
-- =============================================
-- diagnose-post-insert.cjs / diagnose-edge.cjs 가 추가 생성한 테스트 계정·글 정리.
-- auth.users 삭제 시 profiles / posts 가 ON DELETE CASCADE 로 함께 정리된다.
-- =============================================

DELETE FROM posts WHERE title LIKE '진단용 테스트 글%';
DELETE FROM auth.users WHERE email LIKE 'waatdiag%@gmail.com';
