# WCO-Web (WCO Thailand Auction Web Application)

เว็บแอปพลิเคชันสำหรับการประมูลและซื้อขายสินค้าออนไลน์แบบ Full-stack architecture ที่มีการนำ AI มาช่วยในการวิเคราะห์และค้นหารูปภาพ (AI-Driven Image Detection & Analysis)

## 📌 ฟีเจอร์หลัก (Key Features)

*   **ระบบซื้อขายและประมูลสินค้าออนไลน์** - จัดการโพสต์, ตระกร้าสินค้า, ระบบแจ้งเตือน และอื่นๆ
*   **AI Image Search (Lens-like Search)** - ค้นหาสินค้าด้วยภาพถ่าย โดยใช้โมเดล CLIP (Contrastive Language-Image Pretraining) และ `pgvector` ใน Supabase
*   **AI-Generated Image Detection** - ตรวจจับภาพที่สร้างจาก AI ด้วยเทคโนโลยี Sightengine
*   **Reverse Image Search** - ทำงานร่วมกับ Google Lens API 
*   **Authentication & Role Management** - ยืนยันตัวตนและจัดการสิทธิ์การใช้งาน (Admin/User) ควบคู่กับ Supabase JWT tokens

---

## 🏗️ โครงสร้างโปรเจค (Project Structure)

โปรเจคถูกแบ่งออกเป็น 3 ส่วนหลัก (Microservices architecture ย่อยๆ):

### 1. `client-web/` (Frontend)
ส่วนติดต่อผู้ใช้งาน พัฒนาด้วย React 
*   **Tech Stack:** React 18, React Router, TailwindCSS, DaisyUI, Bootstrap, Axios, Supabase-js
*   **การรันโปรเจค:** 
    ```bash
    cd client-web
    npm install
    npm start
    ```

### 2. `server-api/` (Backend / Middleware API)
ส่วน Backend API สำหรับจัดการ Business logic เชื่อมต่อ Frontend เข้ากับฐานข้อมูล Supabase 
*   **Tech Stack:** ASP.NET Core 8.0, C#, Emgu.CV, Supabase C# Client
*   **หน้าที่หลัก:** จัดการ Authentication (JWT), โพสต์สินค้า, Profile, ระบบรูปภาพต่างๆ, Role-based API
*   **การรันโปรเจค:** 
    ```bash
    cd server-api
    dotnet restore
    dotnet run
    ```
    *API จะทำงานที่พอร์ต 5000 หรือ 5001*

### 3. `clip-worker/` (AI Image Processor)
Microservice ย่อยที่เขียนด้วย Python ทำหน้าที่แปลงรูปภาพให้เป็นเวกเตอร์ (512-dim embedding) เพื่อใช้ค้นหาในระบบ AI Image Search
*   **Tech Stack:** Python 3, FastAPI / Uvicorn, OpenAI CLIP (ViT-B-32)
*   **การรันโปรเจค:** 
    ```bash
    cd clip-worker
    python -m venv .venv
    # Windows: .venv\Scripts\activate
    # Mac/Linux: source .venv/bin/activate
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 5002
    ```
    *จะรันบนพอร์ต 5002 เป็นค่าเริ่มต้น*

---

## 🛠️ เทคโนโลยีสแต็ค (Tech Stack & Services)

*   **Frontend:** React, HTML, CSS, TailwindCSS, DaisyUI
*   **Backend:** ASP.NET Core (.NET 8.0)
*   **AI / Machine Learning:** Python, OpenAI CLIP Model
*   **Database & Storage:** Supabase (PostgreSQL), `pgvector` สำหรับ Vector Search
*   **External APIs:** Google Lens API, Sightengine

---

## 🚀 การติดตั้งและใช้งานเบื้องต้น (Getting Started)

1. **เตรียมความพร้อม**
   * ติดตั้ง [Node.js](https://nodejs.org/) (สำหรับ Frontend)
   * ติดตั้ง [.NET 8.0 SDK](https://dotnet.microsoft.com/) (สำหรับ Backend)
   * ติดตั้ง [Python 3](https://www.python.org/) (สำหรับ AI Worker)
   * สมัครและสร้างโปรเจคใน [Supabase](https://supabase.com/)
2. **ตั้งค่าฐานข้อมูล Supabase**
   * เข้าใช้งาน Supabase และสร้าง Services ที่เกี่ยวข้อง (Auth, Database, Storage)
   * รันสคริปต์ SQL setup ในโฟลเดอร์ `client-web/supabase-auction-setup.sql` เป็นต้น เพื่อตรียม Schema
3. **ตั้งค่า Environment Variables**
   * สำหรับ `server-api`: สร้างหรือปรับแต่งไฟล์ `appsettings.json` เพื่อเชื่อมต่อ Supabase URL และ JWT keys 
   * สำหรับ `clip-worker/`: แก้ไขการชี้พอร์ตหรือ API ภายในไฟล์ตามที่กำหนด
4. **เริ่มรันระบบทั้งหมด**
   เปิด Terminal 3 หน้าต่าง เพื่อรัน `client-web`, `server-api` และ `clip-worker` พร้อมกันตามคำสั่งที่ระบุไว้ในส่วนโครงสร้างโปรเจค