# 📁 โครงสร้างโฟลเดอร์ (Folder Structure)

## 🎯 ภาพรวมโครงสร้าง

```
client-web/
├── 📁 api/              → API Service Layer (การเรียก API ทั้งหมด)
├── 📁 components/       → React Components
│   ├── 📁 common/      → Components ทั่วไป (ใช้ซ้ำได้)
│   └── 📁 layout/      → Layout Components (Navbar, Sidebar, etc.)
├── 📁 config/          → Configuration Files (Firebase, etc.)
├── 📁 contexts/        → React Contexts (Global State)
├── 📁 pages/           → Page Components (Routes)
├── 📁 styles/          → CSS Files (Stylesheets)
├── 📁 types/           → TypeScript Types
└── 📁 utils/           → Utility Functions
```

## 📂 รายละเอียดแต่ละโฟลเดอร์

### 🔌 `api/` - API Service Layer
**หน้าที่**: จุดรวมการเรียก API ทั้งหมด

```
api/
└── api.ts              # แยก API calls เป็นหมวดหมู่
    ├── authAPI         # Authentication & Profile
    ├── postsAPI        # Posts management
    ├── cartAPI         # Shopping cart
    ├── offersAPI       # Offers management
    ├── auctionAPI      # Auction bids
    ├── sellerAPI       # Seller profiles
    ├── adminAPI        # Admin functions
    └── chatAPI         # Chat messages
```

**การใช้งาน**:
```typescript
import { postsAPI, cartAPI } from '../api/api';

const posts = await postsAPI.getPosts();
const result = await cartAPI.addToCart(postId);
```

---

### 🧩 `components/` - React Components

#### `components/common/` - Common Components
**หน้าที่**: Components ทั่วไปที่ใช้ซ้ำได้หลายที่

```
common/
├── ButtonComponents.tsx      # Button components
├── IndividualCard.tsx         # Card component
├── IndividualCardsGrid.tsx    # Grid of cards
├── ProfileButton.tsx          # Profile button
└── index.ts                   # Barrel export
```

**การใช้งาน**:
```typescript
import { TCGButton } from '../components/common/ButtonComponents';
// หรือ
import { TCGButton } from '../components';
```

#### `components/layout/` - Layout Components
**หน้าที่**: Components ที่เกี่ยวกับ layout และ navigation

```
layout/
├── Navbar.tsx            # Navigation bar
├── ProfileSidebar.tsx    # Profile sidebar
├── ProtectedRoute.tsx     # Route protection
└── index.ts              # Barrel export
```

**การใช้งาน**:
```typescript
import Navbar from '../components/layout/Navbar';
// หรือ
import { Navbar } from '../components';
```

---

### ⚙️ `config/` - Configuration
**หน้าที่**: ไฟล์ configuration ต่างๆ

```
config/
└── firebase.ts          # Firebase configuration
```

**การใช้งาน**:
```typescript
import { auth, db, storage } from '../config/firebase';
```

---

### 🔄 `contexts/` - React Contexts
**หน้าที่**: Global state management

```
contexts/
├── AuthContext.tsx      # Authentication state
├── CartContext.tsx      # Shopping cart state
└── OfferContext.tsx     # Offers state
```

**การใช้งาน**:
```typescript
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
```

---

### 📄 `pages/` - Page Components
**หน้าที่**: หน้าเว็บต่างๆ (Route components)

```
pages/
├── Home.tsx             # หน้าหลัก
├── Login.tsx            # หน้าเข้าสู่ระบบ
├── Register.tsx         # หน้าสมัครสมาชิก
├── Profile.tsx          # หน้าโปรไฟล์
├── PostDetail.tsx       # หน้ารายละเอียดโพสต์
├── CreatePost.tsx       # หน้าสร้างโพสต์
├── MyPosts.tsx          # หน้าโพสต์ของฉัน
├── Cart.tsx             # หน้าตะกร้า
├── Offers.tsx           # หน้าข้อเสนอ
├── SellerProfile.tsx    # หน้าโปรไฟล์ผู้ขาย
└── AdminDashboard.tsx   # หน้าแดชบอร์ดแอดมิน
```

---

### 🎨 `styles/` - CSS Files
**หน้าที่**: ไฟล์ CSS ทั้งหมด

```
styles/
├── index.css            # Global styles (main stylesheet)
├── auction-bids.css     # Styles สำหรับ auction bids
├── cart.css             # Styles สำหรับ cart
├── individual-card.css  # Styles สำหรับ individual cards
└── seller-profile.css   # Styles สำหรับ seller profile
```

**การใช้งาน**:
```typescript
import '../styles/index.css';
import '../styles/cart.css';
```

---

### 📝 `types/` - TypeScript Types
**หน้าที่**: Type definitions

```
types/
└── index.ts             # Type definitions ทั้งหมด
```

**การใช้งาน**:
```typescript
import { Post, User, CartItem } from '../types';
```

---

### 🛠️ `utils/` - Utility Functions
**หน้าที่**: Utility functions

```
utils/
└── axiosInterceptor.ts  # Axios interceptor
```

**การใช้งาน**:
```typescript
import axios from '../utils/axiosInterceptor';
```

---

## 🔍 วิธีค้นหาไฟล์

### ❓ ต้องการหา Component?
→ ดูใน `src/components/`
  - Components ทั่วไป → `components/common/`
  - Layout components → `components/layout/`

### ❓ ต้องการหา API call?
→ ดูใน `src/api/api.ts`
  - แยกเป็นหมวดหมู่ชัดเจน (authAPI, postsAPI, etc.)

### ❓ ต้องการหา CSS?
→ ดูใน `src/styles/`
  - Global styles → `index.css`
  - Component-specific → ไฟล์ที่เกี่ยวข้อง

### ❓ ต้องการหา Type definition?
→ ดูใน `src/types/index.ts`

### ❓ ต้องการหา Configuration?
→ ดูใน `src/config/`

### ❓ ต้องการหา Context?
→ ดูใน `src/contexts/`

### ❓ ต้องการหา Page?
→ ดูใน `src/pages/`

---

## 📋 หลักการจัดระเบียบ

1. **แยกตามหน้าที่** - แต่ละโฟลเดอร์มีหน้าที่ชัดเจน
2. **ง่ายต่อการค้นหา** - ชื่อโฟลเดอร์บอกได้ว่าข้างในมีอะไร
3. **Scalable** - สามารถเพิ่มไฟล์ใหม่ได้ง่าย
4. **Maintainable** - โครงสร้างชัดเจน ดูแลรักษาง่าย
5. **Consistent** - ใช้รูปแบบเดียวกันทั้งโปรเจกต์

---

## 🚀 การเพิ่มไฟล์ใหม่

### เพิ่ม Component ใหม่
- Components ทั่วไป → `components/common/`
- Layout components → `components/layout/`

### เพิ่ม Page ใหม่
→ เพิ่มใน `pages/`

### เพิ่ม API call ใหม่
→ เพิ่มใน `api/api.ts` ตามหมวดหมู่

### เพิ่ม CSS ใหม่
→ เพิ่มใน `styles/`

### เพิ่ม Type ใหม่
→ เพิ่มใน `types/index.ts`

