# WCO Thailand - CLIP Embedding Worker (AI Worker)

Microservice ย่อยเขียนด้วย Python สำหรับงาน AI โดยเฉพาะ หน้าที่หลักคือการแปลงรูปภาพให้เป็น เวกเตอร์ตัวเลข 512 มิติ (512-dim embedding) ผ่านโมเดล OpenAI CLIP เพื่อนำไปใช้กับฟีเจอร์ค้นหาสินค้าด้วยรูปภาพเสมือน Google Lens (ทำงานร่วมกับฐานข้อมูล `pgvector` ใน Supabase)

โปรเจกต์นี้พัฒนาแยกออกมาเพื่อไม่ให้กระเทือนต่อประสิทธิภาพของแอพหลัก และไม่มีค่าใช้จ่ายในการเรียกใช้ API ภายนอก (Self-hosted)

## 🚀 การติดตั้งและรันโปรเจกต์ (Setup & Run)

1. เข้ามาที่โฟลเดอร์ของ clip-worker
```bash
cd clip-worker
```

2. สร้างและใช้งาน Virtual Environment
```bash
python -m venv .venv

# สำหรับ Windows
.venv\Scripts\activate

# สำหรับ Linux/Mac
source .venv/bin/activate
```

3. ติดตั้ง Dependencies (รวมถึงโมเดลและไลบรารีแปลงภาพ)
```bash
pip install -r requirements.txt
```

4. รัน Uvicorn Server
```bash
uvicorn main:app --host 0.0.0.0 --port 5002
```

*หมายเหตุ: พอร์ต 5000 และ 5001 ถูกสงวนไว้ให้แอพในฝั่ง Server API (ASP.NET Core) ไปแล้ว จึงใช้พอร์ตเริ่มต้นที่ **5002*** 

และเพื่อให้ระบบค้นหาภาพสามารถคุยกับ Worker นี้ได้ อย่าลืมตั้ง `ClipWorker:BaseUrl` ในฝั่ง `server-api` ให้ชี้มาที่พอร์ตนี้ (เช่น `http://localhost:5002`)

## 🌐 API Endpoints ที่ให้บริการ

- **`POST /embed`** 
  - **รับค่า (Body):** `{ "images": ["data:image/jpeg;base64,...", ...] }`
  - **ส่งคืน (Response):** `{ "embeddings": [[float, ...], ...] }` (จะส่งคืน Vector จำนวน 512 ตัวเลขต่อ 1 รูป)
  
- **`GET /health`** 
  - ใช้สำหรับเช็คสถานะการทำงานของเซิร์ฟเวอร์
  - **ส่งคืน:** `{ "status": "ok", "model": "ViT-B-32", "dim": 512 }`
