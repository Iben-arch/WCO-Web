-- ============================================
-- การตั้งค่า Supabase Posts Table (ใหม่)
-- ============================================
-- รัน SQL นี้ใน Supabase Dashboard > SQL Editor
-- หมายเหตุ: DROP TABLE จะลบข้อมูลโพสต์ทั้งหมด!
-- ============================================

-- 1. ลบตารางเก่า (ระวัง: จะลบข้อมูลทั้งหมด!)
DROP TABLE IF EXISTS posts CASCADE;

-- 2. สร้างตาราง posts ใหม่
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  description TEXT,
  category TEXT,
  images TEXT[] DEFAULT '{}',
  "imageStoragePaths" TEXT[] DEFAULT '{}',
  "sellerId" UUID NOT NULL,
  "sellerName" TEXT,
  status TEXT DEFAULT 'active',
  "postType" TEXT DEFAULT 'sale',
  "saleType" TEXT,
  price NUMERIC,
  "individualPrice" NUMERIC,
  "startingBid" NUMERIC,
  "buyNowPrice" NUMERIC,
  "auctionEndDate" TIMESTAMPTZ,
  "cardCount" INTEGER,
  "deckDescription" TEXT,
  "availableQuantity" INTEGER,
  "individualCards" JSONB DEFAULT '[]',
  condition TEXT,
  game TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. เปิดใช้งาน Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 4. ลบ policies เก่า (ถ้ามี)
DROP POLICY IF EXISTS "Service role can manage posts" ON posts;
DROP POLICY IF EXISTS "Anyone can read posts" ON posts;
DROP POLICY IF EXISTS "Users can create own posts" ON posts;
DROP POLICY IF EXISTS "Users can update own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON posts;

-- 5. สร้าง RLS Policies
CREATE POLICY "Service role can manage posts" ON posts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Anyone can read posts" ON posts
  FOR SELECT USING (true);

CREATE POLICY "Users can create own posts" ON posts
  FOR INSERT WITH CHECK (auth.uid()::text = "sellerId"::text);

CREATE POLICY "Users can update own posts" ON posts
  FOR UPDATE USING (auth.uid()::text = "sellerId"::text);

CREATE POLICY "Users can delete own posts" ON posts
  FOR DELETE USING (auth.uid()::text = "sellerId"::text);

-- ============================================
-- หมายเหตุ:
-- ============================================
-- 1. images - เก็บ public URLs จาก Supabase Storage
-- 2. imageStoragePaths - เก็บ path สำหรับลบรูปเมื่อลบโพสต์
-- 3. individualCards - JSONB เก็บ [{ id, imageUrl, quantity, price }]
-- ============================================
