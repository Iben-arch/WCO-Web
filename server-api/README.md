# Server API - Firebase & Cloudinary Middleware

API ที่ทำหน้าที่เป็น Middleware ระหว่าง Client กับ Firebase และ Cloudinary

## คุณสมบัติ

- ✅ **Firebase Integration** - เชื่อมต่อกับ Firebase Firestore สำหรับเก็บข้อมูล
- ✅ **Cloudinary Integration** - อัปโหลดและจัดการรูปภาพผ่าน Cloudinary
- ✅ **Authentication** - รองรับ Firebase Authentication (JWT)
- ✅ **Posts Management** - จัดการ Posts (Create, Read, Update, Delete)
- ✅ **Profile Management** - จัดการ User Profiles และอัปโหลดรูปโปรไฟล์
- ✅ **Image Upload** - อัปโหลดรูปภาพหลายรูปพร้อมกัน
- ✅ **Queue System** - Queue-based processing สำหรับ Create และ Edit operations

## โครงสร้างไฟล์

```
server-api/
├── Controllers/
│   ├── PostsController.cs      # จัดการ Posts (CRUD)
│   ├── AuthController.cs       # จัดการ Authentication และ Profile
│   └── QueueApiController.cs   # Queue/Middleware สำหรับ Create/Edit
├── Services/
│   ├── FirebaseService.cs      # Service สำหรับเชื่อมต่อ Firebase Firestore
│   └── CloudinaryService.cs    # Service สำหรับอัปโหลดรูปภาพไปยัง Cloudinary
├── Program.cs                  # Application configuration
├── ServerApi.csproj           # Project file
└── appsettings.json           # Configuration file
```

## การติดตั้ง

### Prerequisites
- .NET 8.0 SDK หรือสูงกว่า
- Firebase Project (สำหรับ Firestore)
- Cloudinary Account (สำหรับ Image Upload)

### 1. ติดตั้ง Dependencies

```bash
cd server-api
dotnet restore
```

### 2. ตั้งค่า Firebase

1. สร้าง Firebase Project ที่ [Firebase Console](https://console.firebase.google.com/)
2. เปิดใช้งาน Firestore Database
3. ดาวน์โหลด Service Account Key (JSON)
4. ตั้งค่า Environment Variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"
   ```
   หรือใน Windows:
   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"
   ```

### 3. ตั้งค่า Cloudinary

1. สร้าง Account ที่ [Cloudinary](https://cloudinary.com/)
2. ดู API Credentials จาก Dashboard
3. แก้ไข `appsettings.json`:
   ```json
   {
     "Cloudinary": {
       "CloudName": "your-cloud-name",
       "ApiKey": "your-api-key",
       "ApiSecret": "your-api-secret"
     }
   }
   ```

### 4. รัน Application

```bash
dotnet run
```

API จะรันที่ `https://localhost:5001` หรือ `http://localhost:5000`

## API Endpoints

### Posts API

#### สร้าง Post ใหม่
```http
POST /api/posts
Content-Type: multipart/form-data
Authorization: Bearer {token}

{
  "title": "การ์ดเกม",
  "description": "รายละเอียด",
  "category": "Pokemon",
  "postType": "sale",
  "price": "1000",
  "images": [file1, file2, ...]
}
```

#### อ่าน Posts ทั้งหมด
```http
GET /api/posts?category=Pokemon&search=keyword
```

#### อ่าน Post ตาม ID
```http
GET /api/posts/{id}
```

#### อัปเดต Post
```http
PUT /api/posts/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "การ์ดเกม (แก้ไข)",
  "price": 1200
}
```

#### ลบ Post
```http
DELETE /api/posts/{id}
Authorization: Bearer {token}
```

#### ดึงโพสต์ของ User
```http
GET /api/posts/my-posts
Authorization: Bearer {token}
```

### Auth API

#### สร้าง/อัปเดต Profile
```http
POST /api/auth/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "displayName": "ชื่อผู้ใช้",
  "email": "user@example.com"
}
```

#### ดึงข้อมูล Profile
```http
GET /api/auth/profile
Authorization: Bearer {token}
```

#### อัปโหลดรูป Profile
```http
POST /api/auth/upload-profile-image
Authorization: Bearer {token}
Content-Type: multipart/form-data

profileImage: [file]
```

#### ตรวจสอบ Like Status
```http
GET /api/auth/check-like/{postId}
Authorization: Bearer {token}
```

#### Toggle Like
```http
POST /api/auth/like/{postId}
Authorization: Bearer {token}
```

### Queue API

#### สร้างข้อมูลผ่าน Queue
```http
POST /api/QueueApi/create
Content-Type: application/json

{
  "entityType": "POST",
  "data": { ... }
}
```

#### แก้ไขข้อมูลผ่าน Queue
```http
PUT /api/QueueApi/edit/{id}
Content-Type: application/json

{
  "entityType": "POST",
  "data": { ... }
}
```

## Authentication

API ใช้ Firebase Authentication (JWT) สำหรับการยืนยันตัวตน

### การส่ง Token

ส่ง Token ใน Header:
```
Authorization: Bearer {firebase-id-token}
```

### การได้ Token

Client ต้องใช้ Firebase SDK เพื่อ Login และได้ ID Token:

```typescript
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './config/firebase';

const userCredential = await signInWithEmailAndPassword(auth, email, password);
const token = await userCredential.user.getIdToken();
```

## ข้อมูลที่ Server ส่งไปยัง Firebase

### Posts Collection
- `title` - ชื่อโพสต์
- `description` - รายละเอียด
- `category` - หมวดหมู่
- `images` - Array ของ Image URLs จาก Cloudinary
- `cloudinaryPublicIds` - Array ของ Public IDs จาก Cloudinary
- `sellerId` - User ID ของผู้ขาย
- `sellerName` - ชื่อผู้ขาย
- `status` - สถานะ (pending, active, sold, inactive, rejected)
- `postType` - ประเภท (sale, auction)
- `price` - ราคา
- `createdAt` - วันที่สร้าง
- `updatedAt` - วันที่อัปเดตล่าสุด

### Users Collection
- `uid` - User ID
- `displayName` - ชื่อที่แสดง
- `email` - อีเมล
- `photoURL` - URL ของรูปโปรไฟล์
- `cloudinaryPublicId` - Public ID ของรูปใน Cloudinary
- `createdAt` - วันที่สร้าง
- `updatedAt` - วันที่อัปเดตล่าสุด

## ข้อมูลที่ Server ส่งไปยัง Cloudinary

- รูปภาพจาก Posts → Folder: `wco-uploads/posts`
- รูปโปรไฟล์ → Folder: `wco-uploads/profiles`

## Environment Variables

สร้างไฟล์ `.env` หรือตั้งค่า Environment Variables:

```bash
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
```

หรือแก้ไข `appsettings.json`:

```json
{
  "Firebase": {
    "ProjectId": "your-project-id"
  },
  "Cloudinary": {
    "CloudName": "your-cloud-name",
    "ApiKey": "your-api-key",
    "ApiSecret": "your-api-secret"
  }
}
```

## Swagger UI

เมื่อรันใน Development mode สามารถเข้าดู Swagger UI ได้ที่:
- `https://localhost:5001/swagger`

## TODO

- [ ] เพิ่ม Rate Limiting
- [ ] เพิ่ม Caching สำหรับข้อมูลที่อ่านบ่อย
- [ ] เพิ่ม Background Jobs สำหรับประมวลผล Queue
- [ ] เพิ่ม Logging และ Monitoring
- [ ] เพิ่ม Unit Tests
- [ ] เพิ่ม Integration Tests
