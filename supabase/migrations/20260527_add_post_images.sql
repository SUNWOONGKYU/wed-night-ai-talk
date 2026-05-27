-- 2026-05-27 — posts 테이블에 이미지 URL 배열 컬럼 추가
-- claude-news-agent 에이전트의 이미지 업로드 기능 지원
-- 적용: Supabase Studio > SQL Editor에서 실행

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

-- 인덱스는 image_urls 검색이 필요하지 않으므로 추가하지 않음

-- 확인용 코멘트
COMMENT ON COLUMN posts.image_urls IS 'Supabase Storage post-images 버킷의 public URL 배열. 글 본문 렌더링 시 <img> 태그로 표시.';
