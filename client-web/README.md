# WCO Thailand Client Web

โปรเจกต์ React TypeScript สำหรับแพลตฟอร์มซื้อขายการ์ดเกมออนไลน์

## 📁 โครงสร้างโปรเจกต์

```
client-web/
├── api/              # 🔌 API Service - จุดรวมการเรียก API ทั้งหมด
├── components/       # 🧩 React Components
│   ├── common/      # Components ทั่วไป (ใช้ซ้ำได้)
│   └── layout/      # Layout Components (Navbar, Sidebar, etc.)
├── config/          # ⚙️ Configuration Files
├── contexts/        # 🔄 React Contexts (Global State)
├── pages/           # 📄 Page Components (Routes)
├── styles/          # 🎨 CSS Files
├── types/           # 📝 TypeScript Types
└── utils/           # 🛠️ Utility Functions
```

ดูรายละเอียดเพิ่มเติมใน [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md)

## 🚀 การใช้งาน

### ติดตั้ง Dependencies

```bash
npm install
```

### รัน Development Server

```bash
npm start
```

Frontend จะรันที่ `http://localhost:3000`

### Build สำหรับ Production

```bash
npm run build
```

## 🔌 API Service

### หลักการทำงาน

1. **API Service (`src/api/api.ts`)** - จุดรวมการเรียก API ทั้งหมด
   - แยก API calls ออกเป็นหมวดหมู่ (auth, posts, cart, offers, etc.)
   - จัดการ error handling
   - รองรับการทำงานแบบ frontend-only (เมื่อ server ไม่พร้อม)

2. **Contexts** - ใช้ API service แทนการเรียก axios โดยตรง
   - `AuthContext` → ใช้ `authAPI`
   - `CartContext` → ใช้ `cartAPI`
   - `OfferContext` → ใช้ `offersAPI`

3. **Pages** - ควรใช้ API service แทนการเรียก axios โดยตรง

### ตัวอย่างการใช้งาน

```typescript
import { postsAPI, authAPI, cartAPI } from '../api/api';

// ดึงข้อมูล posts
const posts = await postsAPI.getPosts({ category: 'Pokemon' });

// สร้าง post
const newPost = await postsAPI.createPost(formData);

// เพิ่มลงตะกร้า
const result = await cartAPI.addToCart(postId);

// สร้าง offer
const offer = await offersAPI.createOffer(postId, offerData);
```

## 🌐 การเชื่อมต่อกับ Backend

### Development Mode

ใช้ React proxy (ตั้งค่าใน `package.json`):
```json
"proxy": "http://localhost:5000"
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- API calls จะถูก proxy ไปที่ backend อัตโนมัติ

### Production Mode

ตั้งค่า environment variable:
```bash
REACT_APP_SERVER_URL=http://your-backend-url.com
```

### Frontend-Only Mode

เมื่อ backend ไม่พร้อมใช้งาน:
- Frontend จะแสดง UI ปกติ
- API calls จะ return empty array หรือ error message
- ไม่มี error ที่ทำให้แอป crash

## 📚 API Endpoints

ดูรายละเอียด API ทั้งหมดใน [src/api/api.ts](./src/api/api.ts)

### หมวดหมู่ API

- **authAPI** - Authentication & Profile
- **postsAPI** - Posts management
- **cartAPI** - Shopping cart
- **offersAPI** - Offers management
- **auctionAPI** - Auction bids
- **sellerAPI** - Seller profiles
- **adminAPI** - Admin functions
- **chatAPI** - Chat messages

## 🔧 Environment Variables

สร้างไฟล์ `.env` ใน root directory:

```env
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_firebase_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_firebase_app_id

# สำหรับ production
REACT_APP_SERVER_URL=http://your-backend-url.com
```

## 📖 เอกสารเพิ่มเติม

- [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md) - รายละเอียดโครงสร้างโฟลเดอร์
- [STRUCTURE.md](./STRUCTURE.md) - โครงสร้างโปรเจกต์แบบละเอียด

## 🎯 หลักการจัดระเบียบ

1. **แยกตามหน้าที่** - แต่ละโฟลเดอร์มีหน้าที่ชัดเจน
2. **ง่ายต่อการค้นหา** - ชื่อโฟลเดอร์บอกได้ว่าข้างในมีอะไร
3. **Scalable** - สามารถเพิ่มไฟล์ใหม่ได้ง่าย
4. **Maintainable** - โครงสร้างชัดเจน ดูแลรักษาง่าย
