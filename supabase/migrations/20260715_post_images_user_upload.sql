-- 2026-07-15 — post-images 버킷: 로그인 사용자(authenticated) 업로드 허용 (옵션 A)
-- 기존 정책: "Service role uploads only" (에이전트 전용). 여기에 일반 로그인 사용자 경로를 추가한다.
-- 적용: Supabase Studio > SQL Editor 에서 실행.
--
-- 경로 규약: 사용자 업로드는 user/<uid>/... 로 저장한다.
--   INSERT/UPDATE/DELETE 는 본인 폴더(user/<auth.uid()>/)에만 허용 → 남의 파일 손대기 차단.
--   읽기는 버킷이 public 이므로 누구나 가능.

DROP POLICY IF EXISTS "Authenticated users upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users update own folder" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users delete own folder" ON storage.objects;
DROP POLICY IF EXISTS "Public read post images" ON storage.objects;

-- 로그인 사용자: 본인 폴더에 업로드
CREATE POLICY "Authenticated users upload own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = 'user'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 로그인 사용자: 본인 폴더 파일 수정(upsert)
CREATE POLICY "Authenticated users update own folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = 'user'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 로그인 사용자: 본인 폴더 파일 삭제
CREATE POLICY "Authenticated users delete own folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = 'user'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 읽기 정책이 아직 없다면(에이전트 셋업 때 명시 안 했을 수 있음) 공개 읽기 보장
CREATE POLICY "Public read post images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'post-images');
