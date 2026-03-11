-- ============================================
-- Orders & Order Items (คำสั่งซื้อ / รอจัดส่ง / ขายแล้ว)
-- ============================================
-- รันใน Supabase Dashboard > SQL Editor
-- ============================================

-- 1. ตาราง orders (แยกตามผู้ขาย: 1 order ต่อ 1 ผู้ขาย ต่อ 1 คำสั่งซื้อ)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  seller_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending_shipment',
  receipt_url TEXT,
  total_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- status: 'pending_shipment' = รอจัดส่ง, 'sold' = ขายแล้ว (จัดส่งแล้ว มีใบเสร็จ)

-- 2. ตาราง order_items (รายการในคำสั่งซื้อ)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  post_id UUID NOT NULL,
  card_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyer can view own orders" ON orders;
CREATE POLICY "Buyer can view own orders" ON orders FOR SELECT USING (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "Seller can view own orders" ON orders;
CREATE POLICY "Seller can view own orders" ON orders FOR SELECT USING (auth.uid()::text = seller_id::text);
DROP POLICY IF EXISTS "Seller can update own orders" ON orders;
CREATE POLICY "Seller can update own orders" ON orders FOR UPDATE USING (auth.uid()::text = seller_id::text);
DROP POLICY IF EXISTS "Service role orders" ON orders;
CREATE POLICY "Service role orders" ON orders FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "View order items by order" ON order_items;
CREATE POLICY "View order items by order" ON order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND (o.buyer_id = auth.uid() OR o.seller_id::text = auth.uid()::text)));
DROP POLICY IF EXISTS "Service role order_items" ON order_items;
CREATE POLICY "Service role order_items" ON order_items FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- หมายเหตุ:
-- receipt_url เก็บ URL รูปใบเสร็จจาก Supabase Storage (bucket posts หรือ receipts)
-- ============================================
