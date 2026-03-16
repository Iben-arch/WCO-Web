-- ============================================
-- Likes (รายการถูกใจ)
-- ============================================
-- รันใน Supabase Dashboard > SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "postId" UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("userId", "postId")
);

CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes("userId");
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes("postId");

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own likes" ON likes;
CREATE POLICY "Users can view own likes"
ON likes FOR SELECT
USING (auth.uid() = "userId");

DROP POLICY IF EXISTS "Users can insert own likes" ON likes;
CREATE POLICY "Users can insert own likes"
ON likes FOR INSERT
WITH CHECK (auth.uid() = "userId");

DROP POLICY IF EXISTS "Users can delete own likes" ON likes;
CREATE POLICY "Users can delete own likes"
ON likes FOR DELETE
USING (auth.uid() = "userId");

DROP POLICY IF EXISTS "Service role likes" ON likes;
CREATE POLICY "Service role likes"
ON likes FOR ALL
USING (auth.role() = 'service_role');
