-- ============================================
-- การตั้งค่า Supabase Notifications Table
-- ============================================
-- รัน SQL นี้ใน Supabase Dashboard > SQL Editor
-- ใช้เก็บการแจ้งเตือนผู้ใช้ (เช่น โพสต์ถูกปฏิเสธ)
-- ============================================

-- 1. สร้างตาราง notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'post_rejected',
  title TEXT NOT NULL,
  message TEXT,
  post_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Index สำหรับดึงแจ้งเตือนตาม user_id และเรียงตาม created_at
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- 3. เปิดใช้งาน Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 4. Policy: ผู้ใช้เห็นเฉพาะแจ้งเตือนของตัวเอง
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- 5. Policy: เฉพาะ service_role สร้าง/อัปเดตแจ้งเตือนได้ (backend สร้างเมื่อแอดมินปฏิเสธโพสต์)
DROP POLICY IF EXISTS "Service role can manage notifications" ON notifications;
CREATE POLICY "Service role can manage notifications" ON notifications
  FOR ALL USING (auth.role() = 'service_role');

-- 6. ผู้ใช้สามารถอัปเดต read_at ของแจ้งเตือนของตัวเองได้ (สำหรับ mark as read)
DROP POLICY IF EXISTS "Users can update own notifications read_at" ON notifications;
CREATE POLICY "Users can update own notifications read_at" ON notifications
  FOR UPDATE USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);
