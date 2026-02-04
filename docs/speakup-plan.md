# Speak Up 게시판 기능 구현 계획

페이스북 스타일의 커뮤니티 게시판.
- 메인 화면: 최신 3개 미리보기 + "더보기" 버튼
- 별도 페이지(speakup.html): 전체 게시판 (글쓰기, 댓글, 답글, 공감/비공감)
- 회원만 글/댓글/답글/공감 가능. 비회원은 읽기만 가능.

---

## Step 1: Supabase DB 테이블 생성 (SQL Editor에서 실행)

### `posts` 테이블
```sql
CREATE TABLE posts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Members can create posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON posts FOR DELETE USING (auth.uid() = user_id OR is_admin());
```

### `comments` 테이블
```sql
CREATE TABLE comments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id bigint REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  parent_id bigint REFERENCES comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Members can create comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON comments FOR DELETE USING (auth.uid() = user_id OR is_admin());
```

### `post_reactions` 테이블
```sql
CREATE TABLE post_reactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id bigint REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reaction_type text NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reactions" ON post_reactions FOR SELECT USING (true);
CREATE POLICY "Members can create reactions" ON post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reactions" ON post_reactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON post_reactions FOR DELETE USING (auth.uid() = user_id);
```

---

## 구현 5단계

### 단계 1: supabase-config.js — DB 함수 추가
- getPosts, getPost, createPost, updatePost, deletePost
- getComments, createComment, deleteComment
- getReactionCounts, getMyReaction, upsertReaction, removeReaction
- getCommentCount

### 단계 2: speakup.html + js/speakup.js (게시판 페이지)
- 전체 게시판 HTML 페이지
- 게시글 CRUD, 댓글/답글, 공감/비공감 JS

### 단계 3: index.html + main.js (메인 미리보기)
- 메인 화면에 Speak Up 미리보기 섹션 추가
- 네비게이션에 Speak Up 링크 추가
- renderSpeakUpPreview() 함수

### 단계 4: css/style.css (스타일 추가)
- 메인 미리보기 카드 스타일
- 게시판 페이지 전체 스타일
- 반응형 대응

### 단계 5: 최종 검증 및 커밋

---

## 검증 방법
1. 메인 화면: 최신 3개 미리보기 (제목, 작성자, 시간, 댓글 수, 공감 수, 비공감 수)
2. "더보기" → speakup.html 이동
3. 비로그인: 읽기만 가능
4. 로그인: 글 작성, 댓글/답글, 공감/비공감 가능
5. 본인 글/댓글 수정/삭제 가능, 타인 것 불가
6. 공감↔비공감 전환 정상 동작
7. 관리자: 모든 글/댓글 삭제 가능
