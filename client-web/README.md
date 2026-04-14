# WCO Thailand - Client Web (Frontend)

ส่วนติดต่อผู้ใช้งานหลักของโปรเจกต์ WCO Thailand พัฒนาด้วย React และ TypeScript สำหรับแพลตฟอร์มประมูลและซื้อขายสินค้าออนไลน์

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```
client-web/
├── api/              # 🔌 API Service - จุดรวมการเรียก API ทั้งหมด เชื่อมต่อไปยัง server-api
├── components/       # 🧩 React Components
│   ├── common/      # Components ทั่วไป (ใช้ซ้ำได้)
│   └── layout/      # Layout Components (Navbar, Sidebar, etc.)
├── config/          # ⚙️ Configuration Files (Supabase config)
├── contexts/        # 🔄 React Contexts (Global State เช่น Auth, Cart)
├── pages/           # 📄 Page Components (Routes ต่างๆ)
├── styles/          # 🎨 CSS Files (TailwindCSS)
├── types/           # 📝 TypeScript Types
└── utils/           # 🛠️ Utility Functions
```

## 🚀 การใช้งาน (Getting Started)

### การตั้งค่า Environment Variables
สร้างไฟล์ `.env` ใน root directory ของ `client-web` และกำหนดค่าดังนี้:

```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_SERVER_URL=http://localhost:5000  # หรือ URL ของ server-api เมื่อรันบน Production
```

*(หมายเหตุ: ระบบได้เปลี่ยนจากการใช้ Firebase เป็น Supabase Authentication แบบเต็มรูปแบบแล้ว)*

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

## 🔌 API Service และ Backend Integration

- ไฟล์ตั้งค่าการเชื่อมต่อ API ทั้งหมดอยู่ที่ `src/api/api.ts`
- ใช้ React proxy อัตโนมัติในโหมด Development (ตั้งค่าใน `package.json` เป็น `"proxy": "http://localhost:5000"`)
- Backend integration ส่วนใหญ่ใช้งานผ่าน Context (`AuthContext`, `CartContext`) แทนการเรียก Axios ตรงๆ ใน Pages

## 📚 เทคโนโลยีที่ใช้งาน (Tech Stack)
- **Framework:** React 18, TypeScript
- **Styling:** TailwindCSS, DaisyUI, Bootstrap
- **Authentication & Database Client:** `@supabase/supabase-js`
- **Routing:** React Router v6
