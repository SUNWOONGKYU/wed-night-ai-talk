-- posts 테이블에 페이스북 원본 링크 컬럼 추가
ALTER TABLE posts ADD COLUMN IF NOT EXISTS fb_url TEXT;
