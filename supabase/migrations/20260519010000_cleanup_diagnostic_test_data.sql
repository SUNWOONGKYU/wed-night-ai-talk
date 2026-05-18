-- =============================================
-- 글 등록 hang 진단 과정에서 생성된 테스트 데이터 정리 - 2026-05-19
-- =============================================
-- diagnose-post-insert.cjs 가 배포 사이트에서 재현 테스트를 위해
-- 'waatdiag<timestamp>@gmail.com' 계정으로 가입 + '진단용 테스트 글' 을 등록함.
-- auth.users 삭제 시 profiles / posts 가 ON DELETE CASCADE 로 함께 정리된다.
-- =============================================

DELETE FROM posts WHERE title LIKE '진단용 테스트 글%';
DELETE FROM auth.users WHERE email LIKE 'waatdiag%@gmail.com';
