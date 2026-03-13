-- ============================================
-- ตั้งค่าแอดมินคนแรก (Supabase Profiles)
-- ============================================
-- รัน SQL นี้ใน Supabase Dashboard > SQL Editor
-- ใช้เมื่อต้องการให้ผู้ใช้คนใดคนหนึ่งเป็นแอดมิน (เข้าถึง /admin ได้)
-- ============================================

-- วิธีที่ 1: ตั้งแอดมินโดยระบุ User ID (UUID)
-- คัดลอก User ID จาก Supabase Dashboard > Authentication > Users > เลือกผู้ใช้ > copy "User UID"
-- แทนที่ 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' ด้วย User UID จริง

UPDATE profiles
SET role = 'admin', updated_at = NOW()
WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

-- ตรวจสอบผล (ควรได้ 1 row updated)
-- SELECT id, username, role FROM profiles WHERE role = 'admin';


-- ============================================
-- วิธีที่ 2: ตั้งแอดมินโดยอีเมล (ต้องมีฟังก์ชันหรือ subquery)
-- ถ้าไม่มีตารางที่ join auth.users กับ profiles ให้ใช้วิธีที่ 1
-- ============================================
-- ตัวอย่าง: สร้างฟังก์ชัน set_admin_by_email (ทางเลือก)
-- CREATE OR REPLACE FUNCTION public.set_admin_by_email(admin_email TEXT)
-- RETURNS void
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $$
-- BEGIN
--   UPDATE profiles
--   SET role = 'admin', updated_at = NOW()
--   WHERE id = (SELECT id FROM auth.users WHERE email = admin_email LIMIT 1);
-- END;
-- $$;
-- การเรียกใช้ (จาก SQL Editor ด้วย service role หรือจาก backend):
-- SELECT set_admin_by_email('admin@example.com');
-- ============================================
