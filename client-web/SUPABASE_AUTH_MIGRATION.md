# คู่มือการย้ายระบบ Authentication ไปใช้ Supabase Client-Side

## ภาพรวม

โปรเจกต์นี้ได้ย้ายจากการยืนยันตัวตนผ่าน Backend API ไปเป็นการยืนยันตัวตนผ่าน Supabase Client-Side โดยตรง การยืนยันตัวตนทั้งหมดตอนนี้ใช้ Supabase Auth โดยตรงจาก frontend

## สิ่งที่เปลี่ยนแปลง

### 1. ฐานข้อมูล
- สร้างตาราง `profiles` ใหม่ใน Supabase
- Schema ของตาราง: `id`, `username`, `avatar_url`, `role`, `phone`, `address`, `created_at`, `updated_at`
- เปิดใช้งาน Row Level Security (RLS) พร้อม policies ที่เหมาะสม
- Trigger สร้างโปรไฟล์อัตโนมัติเมื่อผู้ใช้สมัครสมาชิก

### 2. การยืนยันตัวตน
- **สมัครสมาชิก**: ใช้ `supabase.auth.signUp()` และสร้างแถวโปรไฟล์
- **เข้าสู่ระบบ**: ใช้ `supabase.auth.signInWithPassword()`
- **ออกจากระบบ**: ใช้ `supabase.auth.signOut()`
- **การจัดการ Session**: จัดการอัตโนมัติโดย Supabase (เก็บใน localStorage)

### 3. ไฟล์ที่แก้ไข
- `src/config/supabase.ts` - การตั้งค่า Supabase client
- `src/contexts/AuthContext.tsx` - ปรับปรุงใหม่ทั้งหมดเพื่อใช้ Supabase auth
- `src/pages/Register.tsx` - เพิ่มฟิลด์ username, ใช้ Supabase signUp
- `src/pages/Login.tsx` - ใช้ Supabase signInWithPassword
- `src/pages/ForgotPassword.tsx` - หน้าสำหรับรีเซ็ตรหัสผ่านใหม่
- `src/components/layout/ProtectedRoute.tsx` - อัปเดตสำหรับสถานะ auth ของ Supabase
- `src/types/index.ts` - เพิ่ม Profile type, อัปเดต User และ AuthContextType
- `src/utils/axiosInterceptor.ts` - อัปเดตเพื่อส่ง Supabase JWT tokens
- `src/App.tsx` - เพิ่ม route สำหรับลืมรหัสผ่าน

## คำแนะนำการตั้งค่า

### ขั้นตอนที่ 1: รัน SQL Script

1. ไปที่ Supabase Dashboard ของคุณ
2. ไปที่ **SQL Editor**
3. เปิดและรัน SQL script: `supabase-profiles-setup.sql`
4. ตรวจสอบว่าตาราง `profiles` ถูกสร้างสำเร็จ

### ขั้นตอนที่ 2: กำหนดค่า Environment Variables

สร้างไฟล์ `.env.local` ในโฟลเดอร์ `client-web`:

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

รับค่าเหล่านี้จาก:
- Supabase Dashboard > Settings > API
- **Project URL** → `REACT_APP_SUPABASE_URL`
- **anon public** key → `REACT_APP_SUPABASE_ANON_KEY`

### ขั้นตอนที่ 3: อัปเดตการตั้งค่า Supabase Auth

1. ไปที่ **Authentication > Settings** ใน Supabase Dashboard
2. เปิดใช้งาน **Email** provider (ถ้ายังไม่ได้เปิดใช้งาน)
3. กำหนดค่า email templates (ไม่บังคับแต่แนะนำ)
4. ตั้งค่า **Site URL** เป็น URL ของ frontend ของคุณ (เช่น `http://localhost:3000`)

### ขั้นตอนที่ 4: ทดสอบการย้ายระบบ

1. เริ่ม development server: `npm start`
2. ทดสอบการสมัครสมาชิก:
   - ไปที่ `/register`
   - กรอก username, email, password
   - ส่งข้อมูลและตรวจสอบว่าโปรไฟล์ถูกสร้างใน Supabase
3. ทดสอบการเข้าสู่ระบบ:
   - ไปที่ `/login`
   - ใช้ข้อมูลที่สมัครไว้
   - ตรวจสอบว่า session ยังคงอยู่เมื่อรีเฟรชหน้า
4. ทดสอบลืมรหัสผ่าน:
   - ไปที่ `/forgot-password`
   - กรอก email
   - ตรวจสอบ email สำหรับลิงก์รีเซ็ต

## ความเข้ากันได้ย้อนหลัง

การย้ายระบบนี้ยังคงความเข้ากันได้ย้อนหลังกับโค้ดที่มีอยู่:

- `userProfile.displayName` ถูกแมปไปที่ `profile.username`
- `userProfile.photoURL` ถูกแมปไปที่ `profile.avatar_url`
- `updateProfile()` รับทั้งชื่อฟิลด์เก่าและใหม่
- หน้าโปรไฟล์ยังคงทำงานกับฟิลด์ฟอร์มที่มีอยู่

## การเปลี่ยนแปลง API

### Backend Auth Endpoints ที่ถูกลบออก (ไม่ใช้แล้ว)
- `POST /api/auth/register` - ตอนนี้ใช้ Supabase โดยตรง
- `POST /api/auth/login` - ตอนนี้ใช้ Supabase โดยตรง
- `GET /api/auth/profile` - ตอนนี้อ่านจากตาราง `profiles`
- `POST /api/auth/profile` - ตอนนี้อัปเดตตาราง `profiles`

### Backend APIs ที่ยังใช้อยู่
- Posts API (`/api/posts/*`)
- Cart API (`/api/cart/*`)
- Auction API (`/api/auction/*`)
- Admin API (`/api/admin/*`)

**หมายเหตุ**: Backend APIs ตอนนี้รับ Supabase JWT tokens ใน header `Authorization` แทน header `X-User-Id`

## การย้ายข้อมูลจากผู้ใช้ที่มีอยู่

หากคุณมีผู้ใช้ในตาราง `users`:

1. ส่งออกข้อมูลผู้ใช้จากตาราง `users`
2. สำหรับแต่ละผู้ใช้:
   - สร้าง Supabase auth user (ถ้ายังไม่มี)
   - สร้างแถวโปรไฟล์ที่สอดคล้องกันในตาราง `profiles`
   - แมป `uid` → `profiles.id`
   - แมป `displayName` → `profiles.username`
   - แมป `photoURL` → `profiles.avatar_url`

## การแก้ปัญหา

### โปรไฟล์ไม่ถูกสร้างเมื่อสมัครสมาชิก
- ตรวจสอบว่า Supabase trigger ทำงานอยู่
- ตรวจสอบว่า RLS policies อนุญาต INSERT
- ตรวจสอบ console ของเบราว์เซอร์สำหรับข้อผิดพลาด

### การเข้าสู่ระบบล้มเหลว
- ตรวจสอบว่า email ถูกยืนยันแล้ว (ถ้าเปิดใช้งานการยืนยัน email)
- ตรวจสอบการตั้งค่า Supabase Auth
- ตรวจสอบว่าข้อมูลประจำตัวถูกต้อง

### Session ไม่คงอยู่
- ตรวจสอบ localStorage ของเบราว์เซอร์
- ตรวจสอบการกำหนดค่า Supabase client
- ตรวจสอบปัญหา CORS

### Backend API คืนค่า 401
- ตรวจสอบว่า backend ตรวจสอบ Supabase JWT tokens
- ตรวจสอบว่า header `Authorization` ถูกส่งไป
- อัปเดต backend เพื่อใช้การตรวจสอบ Supabase JWT

## ขั้นตอนถัดไป

1. **การย้าย Backend**: อัปเดต backend เพื่อตรวจสอบ Supabase JWT tokens แทน header `X-User-Id`
2. **การยืนยัน Email**: กำหนดค่ากระบวนการยืนยัน email ถ้าจำเป็น
3. **การรีเซ็ตรหัสผ่าน**: ใช้งานหน้าสำหรับรีเซ็ตรหัสผ่าน (`/reset-password`)
4. **การย้ายโปรไฟล์**: ย้ายผู้ใช้ที่มีอยู่ไปยังตาราง `profiles` ถ้ามี

## การสนับสนุน

สำหรับปัญหาหรือคำถาม:
- ตรวจสอบเอกสาร Supabase: https://supabase.com/docs
- ดูคู่มือ Supabase Auth: https://supabase.com/docs/guides/auth


