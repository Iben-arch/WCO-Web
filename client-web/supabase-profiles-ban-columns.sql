-- ============================================
-- เพิ่มคอลัมน์แบนผู้ใช้ในตาราง profiles
-- ============================================
-- รัน SQL นี้ใน Supabase Dashboard > SQL Editor
-- ใช้เมื่อกด "แบนผู้ใช้" แล้วเกิดข้อผิดพลาด (เช่น column does not exist)
-- ============================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT,
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

-- ตรวจสอบ: หลังรันแล้วควรมีคอลัมน์ is_banned, ban_reason, banned_at
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles';
