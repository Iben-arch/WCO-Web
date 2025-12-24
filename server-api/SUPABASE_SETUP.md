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

### 3. ตั้งค่า appsettings.json

แก้ไข `appsettings.json`:

```json
{
  "Supabase": {
    "Url": "https://xxxxx.supabase.co",
    "Key": "your-anon-key-here",
    "ServiceRoleKey": "your-service-role-key-here"
  }
}
```

### 4. สร้าง Tables ใน Supabase

ไปที่ SQL Editor ใน Supabase Dashboard และรัน SQL ต่อไปนี้:

#### Table: users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid UUID UNIQUE NOT NULL,
  email TEXT,
  displayName TEXT,
  accountName TEXT,
  photoURL TEXT,
  cloudinaryPublicId TEXT,
  phone TEXT,
  address TEXT,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW(),
  registrationDate TIMESTAMPTZ DEFAULT NOW(),
  isActive BOOLEAN DEFAULT true
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = uid);

-- Policy: Users can update their own data
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = uid);
```

#### Table: posts
```sql
CREATE TABLE posts (
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

-- Policy: Anyone can read posts
CREATE POLICY "Anyone can read posts" ON posts
  FOR SELECT USING (true);

-- Policy: Users can create their own posts
CREATE POLICY "Users can create own posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = sellerId);

-- Policy: Users can update their own posts
CREATE POLICY "Users can update own posts" ON posts
  FOR UPDATE USING (auth.uid() = sellerId);

-- Policy: Users can delete their own posts
CREATE POLICY "Users can delete own posts" ON posts
  FOR DELETE USING (auth.uid() = sellerId);
```

#### Table: likes
```sql
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postId UUID NOT NULL,
  userId UUID NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(postId, userId)
);

-- Enable Row Level Security
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read likes
CREATE POLICY "Anyone can read likes" ON likes
  FOR SELECT USING (true);

-- Policy: Users can create their own likes
CREATE POLICY "Users can create own likes" ON likes
  FOR INSERT WITH CHECK (auth.uid() = userId);

-- Policy: Users can delete their own likes
CREATE POLICY "Users can delete own likes" ON likes
  FOR DELETE USING (auth.uid() = userId);
```

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

