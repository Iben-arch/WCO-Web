-- ============================================
-- การตั้งค่า Supabase Profiles Table
-- ============================================
-- รัน SQL นี้ใน Supabase Dashboard > SQL Editor
-- ============================================

-- 1. สร้างตาราง profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- 2. เปิดใช้งาน Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. ลบ policies ที่มีอยู่แล้ว (ถ้ามี)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Public can read profiles" ON profiles;
DROP POLICY IF EXISTS "Service role can manage profiles" ON profiles;

-- 4. สร้าง RLS Policies

-- Policy: ผู้ใช้สามารถดูโปรไฟล์ของตัวเองได้
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Policy: ผู้ใช้สามารถอัปเดตโปรไฟล์ของตัวเองได้
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- Policy: สาธารณะสามารถอ่านโปรไฟล์ได้ (สำหรับแสดงชื่อผู้ใช้และรูปโปรไฟล์)
CREATE POLICY "Public can read profiles"
ON profiles FOR SELECT
USING (true);

-- Policy: Service role สามารถจัดการโปรไฟล์ทั้งหมดได้ (สำหรับการทำงานของ backend)
CREATE POLICY "Service role can manage profiles"
ON profiles FOR ALL
USING (auth.role() = 'service_role');

-- 5. สร้างฟังก์ชันเพื่อสร้างโปรไฟล์อัตโนมัติเมื่อผู้ใช้สมัครสมาชิก
-- นี่เป็นทางเลือกแต่แนะนำให้ใช้สำหรับการสร้างโปรไฟล์อัตโนมัติ
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. สร้าง trigger เพื่อเรียกใช้ฟังก์ชันเมื่อมีการสมัครสมาชิกผู้ใช้ใหม่
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 7. สร้าง Storage Bucket สำหรับเก็บรูปโปรไฟล์
-- ============================================
-- หมายเหตุ: Bucket จะต้องสร้างผ่าน Supabase Dashboard > Storage
-- หรือใช้ SQL ด้านล่าง (ต้องใช้ service_role key)

-- สร้าง bucket สำหรับเก็บรูปโปรไฟล์ (ถ้ายังไม่มี)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'avatars',
--   'avatars',
--   true,
--   5242880, -- 5MB limit
--   ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
-- )
-- ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 8. สร้าง Storage Policies สำหรับ bucket avatars
-- ============================================

-- ลบ policies เก่าถ้ามี
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;

-- Policy: ผู้ใช้สามารถอัปโหลดรูปโปรไฟล์ของตัวเองได้
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: ผู้ใช้สามารถอัปเดตรูปโปรไฟล์ของตัวเองได้
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: ผู้ใช้สามารถลบรูปโปรไฟล์ของตัวเองได้
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: ทุกคนสามารถดูรูปโปรไฟล์ได้ (public read)
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- ============================================
-- หมายเหตุ:
-- ============================================
-- 1. ตาราง profiles อ้างอิง auth.users(id) พร้อม CASCADE delete
-- 2. RLS policies อนุญาตให้:
--    - ผู้ใช้สามารถดูและอัปเดตโปรไฟล์ของตัวเอง
--    - สาธารณะสามารถอ่านได้สำหรับชื่อผู้ใช้/รูปโปรไฟล์
--    - Service role มีสิทธิ์เข้าถึงเต็มรูปแบบ
-- 3. Trigger จะสร้างโปรไฟล์อัตโนมัติเมื่อผู้ใช้ใหม่สมัครสมาชิก
--    - ชื่อผู้ใช้จะตั้งเป็น 'user_' + 8 ตัวอักษรแรกของ UUID ถ้าไม่ได้ระบุ
--    - บทบาทจะตั้งเป็น 'user' ถ้าไม่ได้ระบุ
-- 4. Storage Bucket 'avatars':
--    - ต้องสร้างผ่าน Supabase Dashboard > Storage > New bucket
--    - ตั้งค่าเป็น Public bucket
--    - ตั้งค่า file size limit เป็น 5MB
--    - ตั้งค่า allowed mime types: image/jpeg, image/png, image/gif, image/webp
-- 5. Storage Policies:
--    - ผู้ใช้สามารถอัปโหลด/อัปเดต/ลบรูปของตัวเองได้ (เก็บใน folder ตาม user ID)
--    - ทุกคนสามารถดูรูปโปรไฟล์ได้ (public read)
-- ============================================

-- ============================================
-- 9. ฟีเจอร์แบนผู้ใช้ (ทางเลือก แนะนำให้เปิดใช้)
-- ============================================
-- เพิ่มคอลัมน์สำหรับจัดการสถานะแบนในตาราง profiles
-- รันส่วนนี้หนึ่งครั้งหลังจากมีตาราง profiles แล้ว

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT,
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

-- หมายเหตุ:
-- - แอดมินจะใช้คอลัมน์ is_banned/ban_reason/banned_at ผ่าน Admin Dashboard
-- - ฝั่งแอป เมื่อผู้ใช้ถูกแบน จะไม่สามารถเข้าสู่ระบบใช้งานได้ (login จะถูกปฏิเสธ)


