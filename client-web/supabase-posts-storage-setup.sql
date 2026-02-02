-- ============================================
-- การตั้งค่า Supabase Storage สำหรับรูปโพสต์
-- ============================================
-- รัน SQL นี้ใน Supabase Dashboard > SQL Editor
-- หมายเหตุ: Bucket 'posts' ต้องสร้างผ่าน Supabase Dashboard > Storage ก่อน
-- ============================================

-- 1. สร้าง Bucket (รันผ่าน Dashboard หรือใช้ SQL ด้านล่าง)
-- ไปที่ Supabase Dashboard > Storage > New bucket
-- Name: posts
-- Public bucket: เปิดใช้งาน
-- File size limit: 10485760 (10MB)
-- Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'posts',
--   'posts',
--   true,
--   10485760,
--   ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
-- )
-- ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. สร้าง Storage Policies สำหรับ bucket posts
-- ============================================

DROP POLICY IF EXISTS "Users can upload post images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own post images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view post images" ON storage.objects;

CREATE POLICY "Users can upload post images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'posts' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own post images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'posts' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Public can view post images"
ON storage.objects FOR SELECT
USING (bucket_id = 'posts');

-- ============================================
-- หมายเหตุ:
-- ============================================
-- 1. โครงสร้าง path: posts/{userId}/{timestamp}-{random}.{ext}
-- 2. ผู้ใช้สามารถอัปโหลด/ลบรูปของตัวเองได้
-- 3. ทุกคนสามารถดูรูปโพสต์ได้ (public read)
-- 4. Bucket ต้องสร้างผ่าน Dashboard ก่อนรัน policies
-- ============================================
