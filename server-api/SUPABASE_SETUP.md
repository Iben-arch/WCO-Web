# การตั้งค่า Supabase

## ขั้นตอนการตั้งค่า

### 1. สร้าง Supabase Project

1. ไปที่ [Supabase](https://supabase.com/)
2. สร้าง Account (ฟรี)
3. สร้าง Project ใหม่
4. รอให้ Project สร้างเสร็จ (ประมาณ 2-3 นาที)

### 2. ดู API Keys และ URL

1. ไปที่ Project Settings > API
2. คัดลอก:
   - **Project URL** (เช่น: `https://xxxxx.supabase.co`)
   - **anon public key** (สำหรับ client-side)
   - **service_role key** (สำหรับ server-side - เก็บเป็นความลับ!)
   - **JWT Secret** (สำหรับ validate JWT tokens - เก็บเป็นความลับ!)
     - **สำหรับ Supabase ใหม่**: ใช้ ECC (P-256) signing keys ซึ่งไม่ต้องตั้งค่า JWT Secret
       - Backend จะใช้ **Authority-based validation** (OpenID Connect discovery) อัตโนมัติ
       - จะดึง public keys จาก Supabase อัตโนมัติ
     - **สำหรับ Supabase เก่า**: ถ้ายังใช้ Legacy JWT Secret
       - ไปที่ **Project Settings > API > JWT Keys > Legacy JWT Secret** tab
       - JWT Secret มักจะเป็น **base64 encoded string ที่ยาวมาก** (ไม่ใช่ UUID)
       - **หมายเหตุ**: KEY ID ที่เห็นใน "JWT Signing Keys" tab **ไม่ใช่** JWT Secret
     - **สำคัญ**: JWT Secret ต่างจาก ServiceRoleKey และ Anon Key

### 3. ตั้งค่า appsettings.json

แก้ไข `appsettings.json`:

```json
{
  "Supabase": {
    "Url": "https://xxxxx.supabase.co",
    "Key": "your-anon-key-here",
    "ServiceRoleKey": "your-service-role-key-here",
    "JwtSecret": "your-jwt-secret-here"
  }
}
```

**หมายเหตุ**: 
- สำหรับ Supabase ใหม่ที่ใช้ ECC keys: **ไม่ต้องตั้งค่า JWT Secret** - Backend จะใช้ Authority-based validation อัตโนมัติ
- สำหรับ Supabase เก่าที่ใช้ Legacy JWT Secret: ต้องตั้งค่า JWT Secret ใน `appsettings.json`
- ถ้าไม่ตั้งค่า JWT Secret: Backend จะใช้ Authority-based validation โดยอัตโนมัติ (รองรับ ECC keys)

### 4. สร้าง Tables ใน Supabase

ไปที่ SQL Editor ใน Supabase Dashboard และรัน SQL ต่อไปนี้:

#### Table: users
```sql
-- สร้างตาราง users (ลบตารางเก่าถ้ามี - ระวัง! จะลบข้อมูลทั้งหมด)
-- DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid UUID UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  "displayName" TEXT,
  accountname TEXT,
  "photoURL" TEXT,
  "cloudinaryPublicId" TEXT,
  phone TEXT,
  address TEXT,
  passwordhash TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "registrationDate" TIMESTAMPTZ DEFAULT NOW(),
  "isActive" BOOLEAN DEFAULT true
);

-- เพิ่ม column ที่อาจยังไม่มี (สำหรับตารางที่มีอยู่แล้ว)
ALTER TABLE users ADD COLUMN IF NOT EXISTS passwordhash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS uid UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accountname TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "photoURL" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "cloudinaryPublicId" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS "registrationDate" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;

-- เพิ่ม UNIQUE constraint สำหรับ email (ถ้ายังไม่มี)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_email_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;
END $$;

-- เพิ่ม UNIQUE constraint สำหรับ uid (ถ้ายังไม่มี)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_uid_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_uid_key UNIQUE (uid);
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ลบ policies เก่า (ถ้ามี) เพื่อสร้างใหม่
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Service role can manage users" ON users;
DROP POLICY IF EXISTS "Public can read users" ON users;

-- Policy: Service role สามารถทำทุกอย่าง (สำหรับ backend operations)
CREATE POLICY "Service role can manage users" ON users
  FOR ALL USING (auth.role() = 'service_role');

-- Policy: Users can read their own data (ถ้าใช้ Supabase Auth)
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid()::text = uid::text);

-- Policy: Users can update their own data (ถ้าใช้ Supabase Auth)
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid()::text = uid::text);

-- Policy: Anyone can read public user info (สำหรับแสดงชื่อและรูปโปรไฟล์)
CREATE POLICY "Public can read users" ON users
  FOR SELECT USING (true);
```

#### Table: posts
```sql
-- สร้างตาราง posts
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  images TEXT[],
  cloudinaryPublicIds TEXT[],
  sellerId UUID NOT NULL,
  sellerName TEXT,
  status TEXT DEFAULT 'pending',
  postType TEXT DEFAULT 'sale',
  price NUMERIC,
  startingBid NUMERIC,
  buyNowPrice NUMERIC,
  auctionEndDate TIMESTAMPTZ,
  saleType TEXT,
  cardCount INTEGER,
  deckDescription TEXT,
  individualPrice NUMERIC,
  availableQuantity INTEGER,
  condition TEXT,
  game TEXT,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- ลบ policies เก่า (ถ้ามี)
DROP POLICY IF EXISTS "Service role can manage posts" ON posts;
DROP POLICY IF EXISTS "Anyone can read posts" ON posts;
DROP POLICY IF EXISTS "Users can create own posts" ON posts;
DROP POLICY IF EXISTS "Users can update own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON posts;

-- Policy: Service role สามารถทำทุกอย่าง
CREATE POLICY "Service role can manage posts" ON posts
  FOR ALL USING (auth.role() = 'service_role');

-- Policy: Anyone can read posts
CREATE POLICY "Anyone can read posts" ON posts
  FOR SELECT USING (true);

-- Policy: Users can create their own posts (ถ้าใช้ Supabase Auth)
CREATE POLICY "Users can create own posts" ON posts
  FOR INSERT WITH CHECK (auth.uid()::text = sellerId::text);

-- Policy: Users can update their own posts (ถ้าใช้ Supabase Auth)
CREATE POLICY "Users can update own posts" ON posts
  FOR UPDATE USING (auth.uid()::text = sellerId::text);

-- Policy: Users can delete their own posts (ถ้าใช้ Supabase Auth)
CREATE POLICY "Users can delete own posts" ON posts
  FOR DELETE USING (auth.uid()::text = sellerId::text);
```

#### Table: likes
```sql
-- สร้างตาราง likes
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "postId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("postId", "userId")
);

-- Enable Row Level Security
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- ลบ policies เก่า (ถ้ามี)
DROP POLICY IF EXISTS "Service role can manage likes" ON likes;
DROP POLICY IF EXISTS "Anyone can read likes" ON likes;
DROP POLICY IF EXISTS "Users can create own likes" ON likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON likes;

-- Policy: Service role สามารถทำทุกอย่าง
CREATE POLICY "Service role can manage likes" ON likes
  FOR ALL USING (auth.role() = 'service_role');

-- Policy: Anyone can read likes
CREATE POLICY "Anyone can read likes" ON likes
  FOR SELECT USING (true);

-- Policy: Users can create their own likes (ถ้าใช้ Supabase Auth)
CREATE POLICY "Users can create own likes" ON likes
  FOR INSERT WITH CHECK (auth.uid()::text = "userId"::text);

-- Policy: Users can delete their own likes (ถ้าใช้ Supabase Auth)
CREATE POLICY "Users can delete own likes" ON likes
  FOR DELETE USING (auth.uid()::text = "userId"::text);
```

### หมายเหตุสำคัญเกี่ยวกับการสร้างตาราง:

1. **Field Names**: 
   - Field ที่มี quotes (`"displayName"`, `"isActive"`) → ใช้ camelCase ใน JSON
   - Field ที่ไม่มี quotes (`email`, `uid`, `accountname`) → ใช้ lowercase ใน JSON

2. **RLS Policies**: 
   - Service role สามารถ bypass RLS ได้ทั้งหมด
   - Backend ใช้ service_role key ดังนั้นจะสามารถจัดการข้อมูลได้ทุกอย่าง

3. **ถ้ามีตารางอยู่แล้ว**: 
   - SQL ด้านบนใช้ `CREATE TABLE IF NOT EXISTS` และ `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
   - ปลอดภัยที่จะรันซ้ำได้

### 5. ตั้งค่า Authentication

1. ไปที่ Authentication > Settings
2. เปิดใช้งาน Email provider
3. (Optional) ตั้งค่า Email templates

### 6. ทดสอบการเชื่อมต่อ

รันโปรเจกต์:
```bash
cd server-api
dotnet run
```

ตรวจสอบว่าไม่มี error เกี่ยวกับ Supabase initialization

## หมายเหตุสำคัญ

1. **Row Level Security (RLS)**: Supabase ใช้ RLS เพื่อความปลอดภัย ต้องตั้งค่า Policies ให้ถูกต้อง
2. **Service Role Key**: เก็บเป็นความลับ! ใช้เฉพาะใน server-side
3. **Anon Key**: ใช้สำหรับ client-side และ public access
4. **UUID**: Supabase ใช้ UUID เป็น primary key แทน string ID
5. **Authentication Flow**: 
   - Backend ใช้ service_role key เพื่อ bypass RLS
   - Frontend ส่ง `X-User-Id` header ในทุก request ที่ต้องการ authentication
   - `userId` ถูกเก็บใน localStorage หลังล็อกอินสำเร็จ
6. **User Data Management**: 
   - ข้อมูล user ถูกสร้างใน database ทันทีเมื่อสมัครสมาชิก
   - ข้อมูล user ถูกดึงอัตโนมัติเมื่อล็อกอินสำเร็จ
   - ไม่ต้องมีฟอร์มเพิ่มเติม ระบบจัดการให้อัตโนมัติ

## Migration จาก Firebase

หากมีข้อมูลใน Firebase อยู่แล้ว:
1. Export ข้อมูลจาก Firebase
2. แปลง format ให้เข้ากับ Supabase schema
3. Import ข้อมูลผ่าน Supabase Dashboard หรือ SQL

## ข้อดีของ Supabase

- ✅ เร็วกว่า Firebase (PostgreSQL)
- ✅ Free tier ดีกว่า (500MB database, 50K MAU)
- ✅ Real-time subscriptions
- ✅ REST API และ GraphQL
- ✅ Open source
- ✅ ไม่มี vendor lock-in

## 📚 API Endpoints ที่เกี่ยวข้อง

### Authentication Endpoints

#### `POST /api/auth/register`
**คำอธิบาย**: สมัครสมาชิก
**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "displayName": "ชื่อผู้ใช้"
}
```
**Response**:
```json
{
  "success": true,
  "userId": "uuid-here",
  "email": "user@example.com",
  "user": {
    "uid": "uuid-here",
    "email": "user@example.com",
    "displayName": "ชื่อผู้ใช้",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "message": "สมัครสมาชิกสำเร็จ"
}
```

#### `POST /api/auth/login`
**คำอธิบาย**: ล็อกอิน
**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
**Response**:
```json
{
  "success": true,
  "userId": "uuid-here",
  "email": "user@example.com",
  "user": {
    "uid": "uuid-here",
    "email": "user@example.com",
    "displayName": "ชื่อผู้ใช้",
    "phone": "0812345678",
    "address": "ที่อยู่",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "message": "เข้าสู่ระบบสำเร็จ"
}
```

#### `GET /api/auth/profile`
**คำอธิบาย**: ดึงข้อมูล user profile
**Headers**: `X-User-Id: {userId}` (ส่งอัตโนมัติผ่าน axios interceptor)
**Response**:
```json
{
  "success": true,
  "user": {
    "uid": "uuid-here",
    "email": "user@example.com",
    "displayName": "ชื่อผู้ใช้",
    "phone": "0812345678",
    "address": "ที่อยู่",
    "photoURL": "https://...",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

#### `POST /api/auth/profile`
**คำอธิบาย**: อัปเดตข้อมูล user profile
**Headers**: `X-User-Id: {userId}`
**Request Body** (เฉพาะ field ที่ต้องการอัปเดต):
```json
{
  "displayName": "ชื่อใหม่",
  "phone": "0812345678",
  "address": "ที่อยู่ใหม่",
  "email": "newemail@example.com"
}
```
**Response**:
```json
{
  "success": true,
  "message": "บันทึกข้อมูลสำเร็จ",
  "user": {
    // ข้อมูล user ที่อัปเดตแล้ว
  }
}
```

## 📋 วิธีสร้าง Tables ใน Supabase (สรุป)

### ขั้นตอนที่ 1: เข้าสู่ Supabase Dashboard

1. ไปที่ [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. เลือก Project ของคุณ
3. ไปที่เมนู **SQL Editor** (ด้านซ้าย)

### ขั้นตอนที่ 2: สร้างตาราง users

1. คลิก **New Query**
2. คัดลอกและวาง SQL สำหรับตาราง `users` (จากส่วน "### 4. สร้าง Tables ใน Supabase" ด้านบน)
3. คลิก **Run** หรือกด `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
4. รอจนเห็นข้อความ "Success"

### ขั้นตอนที่ 3: สร้างตาราง posts

1. เปิด Query ใหม่หรือลบ SQL เก่า
2. คัดลอกและวาง SQL สำหรับตาราง `posts`
3. คลิก **Run**
4. รอจนเห็นข้อความ "Success"

### ขั้นตอนที่ 4: สร้างตาราง likes

1. เปิด Query ใหม่หรือลบ SQL เก่า
2. คัดลอกและวาง SQL สำหรับตาราง `likes`
3. คลิก **Run**
4. รอจนเห็นข้อความ "Success"

### ขั้นตอนที่ 5: ตรวจสอบว่าสร้างสำเร็จ

1. ไปที่เมนู **Table Editor** (ด้านซ้าย)
2. ควรเห็นตาราง `users`, `posts`, และ `likes`
3. คลิกที่ตาราง `users` เพื่อดูโครงสร้าง columns

### ⚠️ หมายเหตุสำคัญ

- **ถ้ามีตารางอยู่แล้ว**: SQL จะใช้ `CREATE TABLE IF NOT EXISTS` และ `ADD COLUMN IF NOT EXISTS` ดังนั้นปลอดภัยที่จะรันซ้ำได้
- **ถ้าต้องการเริ่มใหม่**: ใช้ `DROP TABLE IF EXISTS users CASCADE;` ก่อนสร้างใหม่ (จะลบข้อมูลทั้งหมด!)
- **RLS Policies**: Service role สามารถ bypass RLS ได้ทั้งหมด ดังนั้น backend จะทำงานได้ปกติ

## 🔄 ระบบ Authentication Flow

### 1. สมัครสมาชิก (Register)

เมื่อผู้ใช้สมัครสมาชิก:
1. **Frontend**: ส่งข้อมูล email, password, displayName ไปที่ `/api/auth/register`
2. **Backend**: 
   - ตรวจสอบว่าอีเมลซ้ำหรือไม่
   - Hash password ด้วย BCrypt
   - สร้าง record ใหม่ในตาราง `users` พร้อมข้อมูล:
     - `uid` (UUID)
     - `email`
     - `displayName`
     - `passwordhash` (hashed)
     - `isActive` = true
     - `createdAt`, `registrationDate`
3. **Response**: ส่งข้อมูล user profile กลับมา (ไม่รวม passwordhash)
4. **Frontend**: เก็บ `userId` ใน localStorage และแสดงข้อมูล user

**ผลลัพธ์**: User record ถูกสร้างใน database ทันที พร้อมข้อมูลพื้นฐาน

### 2. ล็อกอิน (Login)

เมื่อผู้ใช้ล็อกอิน:
1. **Frontend**: ส่ง email และ password ไปที่ `/api/auth/login`
2. **Backend**:
   - ค้นหา user จาก email
   - ตรวจสอบ password ด้วย BCrypt.Verify()
   - ตรวจสอบว่า `isActive` = true
3. **Response**: ส่งข้อมูล user profile ทั้งหมดกลับมา (ไม่รวม passwordhash)
4. **Frontend**: 
   - เก็บ `userId` และ `userEmail` ใน localStorage
   - ดึงข้อมูล user profile อัตโนมัติ (ถ้ายังไม่มี)
   - อัปเดต state `currentUser` และ `userProfile`

**ผลลัพธ์**: ผู้ใช้สามารถเข้าถึงข้อมูลตัวเองได้ทันที ไม่ต้องมีฟอร์มเพิ่มเติม

### 3. ดึงข้อมูล User Profile

**หลังล็อกอินแล้ว ระบบจะดึงข้อมูล user อัตโนมัติผ่าน 2 วิธี:**

#### วิธีที่ 1: จาก Login Response (อัตโนมัติ)
- เมื่อล็อกอินสำเร็จ Backend จะส่งข้อมูล user profile กลับมา
- Frontend จะเก็บข้อมูลไว้ใน `userProfile` state ทันที

#### วิธีที่ 2: เรียก API แยก (ถ้าต้องการ refresh ข้อมูล)
- **Endpoint**: `GET /api/auth/profile`
- **Headers**: `X-User-Id: {userId}` (ส่งอัตโนมัติผ่าน axios interceptor)
- **Response**: ข้อมูล user profile ทั้งหมด

```typescript
// ใน Frontend สามารถเรียกใช้ได้:
const { userProfile, currentUser } = useAuth();

// หรือเรียก API โดยตรง:
const profile = await authAPI.getProfile();
```

### 4. อัปเดตข้อมูล User Profile

**ไม่ต้องมีฟอร์มเพิ่มเติม!** ระบบมี endpoint สำหรับอัปเดตข้อมูลอยู่แล้ว:

- **Endpoint**: `POST /api/auth/profile`
- **Headers**: `X-User-Id: {userId}`
- **Body**: 
  ```json
  {
    "displayName": "ชื่อใหม่",
    "phone": "0812345678",
    "address": "ที่อยู่",
    "email": "email@example.com"
  }
  ```
- **Response**: ข้อมูล user profile ที่อัปเดตแล้ว

**ตัวอย่างการใช้งาน:**
- หน้า Profile (`/profile`) มีฟอร์มสำหรับแก้ไขข้อมูล
- เมื่อบันทึก จะเรียก `POST /api/auth/profile` เพื่ออัปเดต
- ข้อมูลจะถูกบันทึกลง database ทันที

### 📝 สรุป: ข้อมูล User ถูกเก็บอยู่ที่ไหน?

1. **Database (Supabase)**: ข้อมูลทั้งหมดถูกเก็บในตาราง `users`
   - สร้างเมื่อสมัครสมาชิก
   - อัปเดตเมื่อแก้ไข profile

2. **Frontend State**: 
   - `currentUser`: ข้อมูลพื้นฐาน (uid, email, displayName)
   - `userProfile`: ข้อมูลเต็ม (ทุก field จาก database)

3. **localStorage**: 
   - `userId`: ใช้สำหรับ authentication
   - `userEmail`: ใช้สำหรับแสดงผล

**ไม่ต้องมีฟอร์มเพิ่มเติม!** ระบบดึงข้อมูลจาก database อัตโนมัติเมื่อล็อกอิน

## 🧪 ทดสอบระบบ

### ทดสอบการสมัครสมาชิก

1. รัน Backend: `cd server-api && dotnet run`
2. รัน Frontend: `cd client-web && npm start`
3. ไปที่หน้า `/register`
4. กรอกข้อมูล:
   - ชื่อที่ใช้แสดง
   - อีเมล
   - รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)
5. คลิก "สมัครสมาชิก"
6. ตรวจสอบใน Supabase Table Editor ว่ามีข้อมูล user ใหม่หรือไม่:
   - ไปที่ **Table Editor** > `users`
   - ควรเห็น record ใหม่พร้อมข้อมูลที่กรอก

### ทดสอบการล็อกอิน

1. ไปที่หน้า `/login`
2. ใช้ email และ password ที่สมัครไว้
3. ควรเข้าสู่ระบบสำเร็จและไปที่หน้าแรก
4. ตรวจสอบ Console (F12) ควรเห็นข้อมูล user profile

### ทดสอบการดึงข้อมูล User Profile

1. หลังจากล็อกอิน สำเร็จ
2. เปิด Developer Tools (F12) > Console
3. ตรวจสอบว่า:
   - `localStorage.getItem('userId')` มีค่า (ไม่ใช่ null)
   - `localStorage.getItem('userEmail')` มีค่า
4. ไปที่หน้า Profile (`/profile`)
5. ควรเห็นข้อมูล user ทั้งหมด:
   - ชื่อที่ใช้แสดง
   - อีเมล
   - หมายเลขโทรศัพท์ (ถ้ามี)
   - ที่อยู่ (ถ้ามี)

### ทดสอบการอัปเดตข้อมูล User Profile

1. ไปที่หน้า Profile (`/profile`)
2. คลิกปุ่ม "แก้ไขข้อมูล"
3. แก้ไขข้อมูล เช่น:
   - เปลี่ยนชื่อ
   - เพิ่มเบอร์โทรศัพท์
   - เพิ่มที่อยู่
4. คลิก "บันทึกข้อมูล"
5. ตรวจสอบใน Supabase Table Editor ว่าข้อมูลถูกอัปเดตหรือไม่

### ตรวจสอบใน Supabase

1. ไปที่ **Table Editor** > `users`
2. ควรเห็นข้อมูล user ที่สร้างขึ้น
3. ตรวจสอบว่า field names ถูกต้อง:
   - `uid` (lowercase) - UUID
   - `email` (lowercase) - อีเมล
   - `displayName` (camelCase) - ชื่อที่ใช้แสดง
   - `accountname` (lowercase) - ชื่อบัญชี
   - `passwordhash` (lowercase) - รหัสผ่านที่ hash แล้ว (ไม่ควรเห็นรหัสผ่านจริง)
   - `isActive` (camelCase) - สถานะ (ควรเป็น true)
   - `createdAt` (camelCase) - วันที่สร้าง
   - `phone` (lowercase) - เบอร์โทรศัพท์ (ถ้ามี)
   - `address` (lowercase) - ที่อยู่ (ถ้ามี)

## 🎯 สรุป: ไม่ต้องมีฟอร์มเพิ่มเติม!

**ระบบทำงานแบบนี้:**

1. ✅ **สมัครสมาชิก**: ข้อมูลถูกบันทึกลง database ทันที
2. ✅ **ล็อกอิน**: ดึงข้อมูล user จาก database อัตโนมัติ
3. ✅ **แสดงข้อมูล**: ใช้ข้อมูลจาก `userProfile` state (ถูกอัปเดตอัตโนมัติ)
4. ✅ **แก้ไขข้อมูล**: ใช้ฟอร์มในหน้า Profile (`/profile`)

**ไม่ต้องสร้างฟอร์มเพิ่มเติม!** ระบบจัดการข้อมูล user ทั้งหมดให้อัตโนมัติ

