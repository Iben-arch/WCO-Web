-- ============================================
-- การตั้งค่า Supabase Cart Items Table
-- ============================================
-- รัน SQL นี้ใน Supabase Dashboard > SQL Editor
-- ============================================

-- 1. สร้างตาราง cart_items
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL,
  card_id TEXT,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. สร้าง unique index (รองรับ card_id เป็น NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_unique 
ON cart_items (user_id, post_id, COALESCE(card_id, ''));

-- 3. สร้าง index สำหรับ query เร็ว
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_post_id ON cart_items(post_id);

-- 4. เปิดใช้งาน Row Level Security
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- 5. สร้าง RLS Policies
DROP POLICY IF EXISTS "Users can view own cart" ON cart_items;
CREATE POLICY "Users can view own cart"
ON cart_items FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own cart" ON cart_items;
CREATE POLICY "Users can insert own cart"
ON cart_items FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own cart" ON cart_items;
CREATE POLICY "Users can delete own cart"
ON cart_items FOR DELETE
USING (auth.uid() = user_id);

-- 6. Service role policy สำหรับ backend
DROP POLICY IF EXISTS "Service role can manage cart" ON cart_items;
CREATE POLICY "Service role can manage cart"
ON cart_items FOR ALL
USING (auth.role() = 'service_role');
