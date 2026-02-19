-- =============================================
-- STEP 3: comments + post_reactions 정책
-- =============================================

DROP POLICY IF EXISTS "Anyone can view comments" ON comments;
DROP POLICY IF EXISTS "Users can insert own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
DROP POLICY IF EXISTS "Admins can delete any comment" ON comments;

CREATE POLICY "Anyone can view comments"
  ON comments FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own comments"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any comment"
  ON comments FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Anyone can view reactions" ON post_reactions;
DROP POLICY IF EXISTS "Users can insert own reactions" ON post_reactions;
DROP POLICY IF EXISTS "Users can update own reactions" ON post_reactions;
DROP POLICY IF EXISTS "Users can delete own reactions" ON post_reactions;

CREATE POLICY "Anyone can view reactions"
  ON post_reactions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own reactions"
  ON post_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reactions"
  ON post_reactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions"
  ON post_reactions FOR DELETE
  USING (auth.uid() = user_id);
