-- ============================================
-- ตั้งค่าประมูล (Auction): ตาราง bids + คอลัมน์โพสต์
-- ============================================
-- รันใน Supabase Dashboard > SQL Editor หลังมีตาราง posts แล้ว
-- ============================================

-- 1. ตารางประวัติการประมูล
CREATE TABLE IF NOT EXISTS auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL,
  bidder_name TEXT NOT NULL,
  bid_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auction_bids_post_id ON auction_bids(post_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_created_at ON auction_bids(created_at DESC);

ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role auction_bids" ON auction_bids;
CREATE POLICY "Service role auction_bids" ON auction_bids FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Anyone can read auction_bids" ON auction_bids;
CREATE POLICY "Anyone can read auction_bids" ON auction_bids FOR SELECT USING (true);

-- 2. เพิ่มคอลัมน์ประมูลใน posts (ถ้ายังไม่มี)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS "currentBid" NUMERIC,
  ADD COLUMN IF NOT EXISTS "highestBidder" UUID,
  ADD COLUMN IF NOT EXISTS "bidCount" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "winnerId" UUID,
  ADD COLUMN IF NOT EXISTS "paymentDeadline" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "auctionStatus" TEXT;

-- auctionStatus: 'active' = กำลังประมูล, 'won_pending_payment' = มีผู้ชนะรอชำระ, 'sold' = ชำระแล้ว, 'auction_released' = หลุด(ไม่ชำระภายในเวลา) รอเจ้าของตัดสินใจประมูลใหม่

COMMENT ON COLUMN posts."auctionStatus" IS 'active | won_pending_payment | sold | auction_released';
