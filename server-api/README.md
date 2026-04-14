# WCO Thailand - Server API (Backend)

API Backend และ Middleware ของโปรเจกต์ WCO Thailand พัฒนาด้วย ASP.NET Core 8.0 ทำหน้าที่เชื่อมต่อ Business Logic ต่างๆ ระหว่าง Frontend และฐานข้อมูล Supabase

## 🌟 คุณสมบัติ (Features)

- ✅ **Supabase Integration** - เชื่อมต่อกับฐานข้อมูล PostgreSQL และ Storage บน Supabase แทรกกลางเพื่อตรวจสอบข้อมูล
- ✅ **Authentication (Supabase JWT)** - ตรวจสอบสิทธิ์ผู้ใช้งานจาก Token ของ Supabase และจัดการสิทธิการใช้งาน (Role-based: Admin/User)
- ✅ **Auction & Posts Management** - จัดการระบบโพสต์และประมูลสินค้า
- ✅ **Profile Management** - ดึงและจัดการข้อมูลผู้ใช้งานจากตาราง `profiles` ของ Supabase
- ✅ **AI Services Integration** - เชื่อมต่อกับ `clip-worker` (ค้นหาด้วยรูป) และบริการตรวจสอบภาพ AI-generated (Sightengine)

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```
server-api/
├── Controllers/
│   ├── AuthController.cs       # ดูแลการตรวจสอบ Token และสิทธิ์ของ Admin
│   ├── PostsController.cs      # ระบบจัดการร้านค้า/โพสต์ทั่วไป
│   ├── CartController.cs       # ระบบจัดการตะกร้าสินค้า 
│   ├── ...                     # Controller อื่นๆ
├── Services/
│   └── SupabaseService.cs      # Service หลักสำหรับ query และเรียกใช้ Supabase
├── Program.cs                  # กำหนด Middleware, Swagger และ Configuration
├── appsettings.json            # ไฟล์สำหรับตั้งค่า Environment 
└── ServerApi.csproj            # ไฟล์คอนฟิกโปรเจกต์ .NET
```

## 🚀 การติดตั้งและใช้งาน (Getting Started)

### 1. การตั้งค่า Environment (`appsettings.json`)
จำเป็นต้องระบุ URL และ Service Key ของ Supabase:

```json
{
  "Supabase": {
    "Url": "https://your-project.supabase.co",
    "ServiceRoleKey": "your-supabase-service-role-key",
    "JwtSecret": "your-jwt-secret-from-supabase"
  },
  "ClipWorker": {
    "BaseUrl": "http://localhost:5002"
  }
}
```

### 2. รัน Server
รันคำสั่ง:
```bash
dotnet restore
dotnet run
```
API จะรันที่ `https://localhost:5001` หรือ `http://localhost:5000`

### 3. ดู API Docs (Swagger UI)
เมื่อรันใน Development Mode สามารถเปิด Swagger UI ได้ที่ `http://localhost:5000/swagger`

## 🔐 Authentication
ระบบปัจจุบันใช้ **Supabase JWT** (เลิกใช้ Firebase แล้ว)
ทุกครั้งที่เรียก API ที่ต้องการสิทธิ์ ให้ส่ง Header:
```http
Authorization: Bearer {SUPABASE_ACCESS_TOKEN}
```
สำหรับ API ของผู้ดูแลระบบ บาง endpoint จะเช็ค Header `X-User-Id` ร่วมกับ Token ด้วย
