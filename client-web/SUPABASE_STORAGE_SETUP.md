# คู่มือการตั้งค่า Supabase Storage สำหรับรูปโปรไฟล์

## ขั้นตอนการตั้งค่า

### 1. สร้าง Storage Bucket

1. ไปที่ **Supabase Dashboard** → **Storage**
2. คลิก **New bucket**
3. ตั้งค่าดังนี้:
   - **Name**: `avatars`
   - **Public bucket**: ✅ เปิดใช้งาน (เพื่อให้ทุกคนสามารถดูรูปโปรไฟล์ได้)
   - **File size limit**: `5242880` (5MB)
   - **Allowed MIME types**: 
     - `image/jpeg`
     - `image/png`
     - `image/gif`
     - `image/webp`

### 2. รัน SQL Policies

รัน SQL ต่อไปนี้ใน **Supabase Dashboard** → **SQL Editor**:

```sql
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
```

### 3. ตรวจสอบการตั้งค่า

หลังจากตั้งค่าเสร็จแล้ว:

1. ✅ Bucket `avatars` ถูกสร้างและตั้งค่าเป็น Public
2. ✅ Storage Policies ถูกสร้างแล้ว
3. ✅ ผู้ใช้สามารถอัปโหลดรูปโปรไฟล์ได้ผ่านหน้า Profile

## โครงสร้างไฟล์ใน Storage

รูปโปรไฟล์จะถูกเก็บในรูปแบบ:
```
avatars/
  └── {user-id}/
      └── {timestamp}-{random}.{ext}
```

ตัวอย่าง:
```
avatars/
  └── 123e4567-e89b-12d3-a456-426614174000/
      └── 1703123456789-abc123.jpg
```

## การใช้งาน

เมื่อผู้ใช้อัปโหลดรูปโปรไฟล์:

1. ระบบจะอัปโหลดไฟล์ไปยัง `avatars/{userId}/{filename}`
2. ระบบจะลบรูปเก่าถ้ามี (ถ้ามี `avatar_url` เก่า)
3. ระบบจะอัปเดต `avatar_url` ในตาราง `profiles` ด้วย public URL
4. รูปจะแสดงในหน้า Profile ทันที

## หมายเหตุ

- รูปโปรไฟล์จะถูกเก็บใน Supabase Storage แทนการอัปโหลดผ่าน Backend API
- Public URL จะถูกเก็บในฟิลด์ `avatar_url` ของตาราง `profiles`
- ผู้ใช้สามารถอัปโหลด/อัปเดต/ลบรูปของตัวเองได้เท่านั้น
- ทุกคนสามารถดูรูปโปรไฟล์ได้ (public read)

