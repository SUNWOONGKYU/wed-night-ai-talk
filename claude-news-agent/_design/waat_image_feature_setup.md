---
title: "WAAT 이미지 업로드 기능 적용 가이드 — A 옵션 (에이전트 전용)"
created: 2026-05-27
mode: 별도 트랙 (claude-news-agent Phase 6 조립 전 완료 필요)
---

# WAAT 이미지 업로드 기능 적용 — PO 작업 가이드

claude-news-agent가 Anthropic 새 글의 이미지를 WAAT에 함께 게시할 수 있도록 사이트에 최소 변경.

## 변경 범위 (A 옵션 — 에이전트 전용)

| 항목 | 변경 |
|---|---|
| **Supabase `posts` 테이블** | `image_urls text[]` 컬럼 추가 |
| **Supabase Storage** | `post-images` 버킷 신설 (public, 5MB 제한) |
| **`js/speakup.js`** | 글 렌더링 시 `image_urls` 배열을 `<img>` 갤러리로 표시 ✅ 이미 수정됨 |
| **글쓰기 UI** | 안 건드림 (에이전트만 이미지 첨부) |

---

## PO 적용 순서 (4단계)

### ① SQL 마이그레이션 적용

Supabase Studio → SQL Editor → 다음 파일 내용 실행:

📁 `G:\내 드라이브\WAAT\supabase\migrations\`
📄 `20260527_add_post_images.sql`

```sql
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';
```

확인 — `posts` 테이블에 `image_urls` 컬럼이 생기고 기본값 `{}` (빈 배열).

### ② Storage 버킷 생성

Supabase Studio → **Storage** → **New bucket**:

| 항목 | 값 |
|---|---|
| 버킷 이름 | `post-images` |
| Public | ✅ ON (게시판이라 누구나 이미지 조회 가능해야) |
| File size limit | `5 MB` |
| Allowed MIME types | `image/png, image/jpeg, image/webp, image/gif` |

### ③ Storage RLS 정책 설정

Supabase Studio → Storage → `post-images` 버킷 → Policies → New policy:

**Policy 1 — 누구나 읽기 (public 자동이지만 명시)**
```sql
CREATE POLICY "Public read post images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'post-images');
```

**Policy 2 — service_role만 업로드 (에이전트 전용)**
```sql
CREATE POLICY "Service role uploads only"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'post-images');
```

(추후 일반 사용자 업로드 허용 시 — `TO authenticated` 정책 추가)

### ④ 사이트 배포 (`speakup.js` 수정본 반영)

이미 `js/speakup.js`가 수정됐으니 (라인 35 근처 + 글 렌더링 부분):

```powershell
cd "G:\내 드라이브\WAAT"
git add js/speakup.js supabase/migrations/20260527_add_post_images.sql
git commit -m "feat: posts.image_urls 컬럼 + 글 렌더링에 이미지 갤러리 추가 (claude-news-agent 지원)"
git push
# Vercel 자동 배포 ~30초~1분
```

---

## 검증 (PO가 적용 후 확인)

### 1. 컬럼 존재
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'posts' AND column_name = 'image_urls';
-- 결과: image_urls | ARRAY
```

### 2. Storage 버킷 존재
Supabase Studio → Storage → `post-images` 버킷이 보이고 public 표시

### 3. 사이트 렌더링 동작
- 임시 글 1개에 `image_urls = ARRAY['https://picsum.photos/600/400']::text[]` 로 INSERT
- WAAT /speakup 페이지 로드 → 그 글에 이미지가 본문 아래 표시되는지 확인
- 표시되면 OK → 임시 글 삭제

---

## claude-news-agent (Phase 6) 측 사용 흐름

에이전트가 service_role_key로 다음 작업:

```python
# 1. Anthropic 원본 이미지 다운로드
img_bytes = requests.get(anthropic_image_url).content

# 2. Storage 버킷에 업로드
storage_path = f"news/{int(time.time())}_{filename}"
supabase_storage.upload(
    bucket="post-images",
    path=storage_path,
    file=img_bytes,
    content_type="image/png"
)

# 3. public URL 받기
public_url = f"{SUPABASE_URL}/storage/v1/object/public/post-images/{storage_path}"

# 4. posts 테이블에 INSERT
supabase.table("posts").insert({
    "user_id": PO_USER_ID,  # admin 계정
    "title": title_ko,
    "content": content_ko,
    "category": "AI 새 소식",
    "image_urls": [public_url1, public_url2, ...],
}).execute()
```

---

## 알려진 한계

- 글쓰기 UI에 이미지 첨부 폼 없음 → 일반 사용자는 이미지 첨부 불가 (에이전트만)
- 추후 B 옵션 (사용자 글쓰기 UI 확장) 별도 진행 가능
- 이미지 크기 5MB 제한 — Anthropic 원본이 더 크면 다운로드 후 압축 필요 (Pillow)
