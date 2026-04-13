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
  card_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE auction_bids ADD COLUMN IF NOT EXISTS card_id TEXT;

CREATE INDEX IF NOT EXISTS idx_auction_bids_post_id ON auction_bids(post_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_card_id ON auction_bids(card_id);
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
  ADD COLUMN IF NOT EXISTS "auctionStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "defaultedBidders" JSONB;

-- auctionStatus: 'active' = กำลังประมูล, 'won_pending_payment' = มีผู้ชนะรอชำระ, 'sold' = ชำระแล้ว, 'auction_released' = หลุด(ไม่ชำระภายในเวลา) รอเจ้าของตัดสินใจประมูลใหม่

COMMENT ON COLUMN posts."auctionStatus" IS 'active | won_pending_payment | sold | auction_released';

-- 3. ประมูลแยกใบ: สถานะผู้ชนะแต่ละใบ
CREATE TABLE IF NOT EXISTS auction_card_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  winner_id UUID NOT NULL,
  bid_amount NUMERIC NOT NULL,
  payment_deadline TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, card_id)
);
CREATE INDEX IF NOT EXISTS idx_auction_card_winners_post ON auction_card_winners(post_id);
ALTER TABLE auction_card_winners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role auction_card_winners" ON auction_card_winners;
CREATE POLICY "Service role auction_card_winners" ON auction_card_winners FOR ALL USING (auth.role() = 'service_role');
