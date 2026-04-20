# นวนิพนธ์ / ปริญญานิพนธ์ (Thesis) 
**หัวข้อ:** การพัฒนาระบบประมูลและซื้อขายการ์ดเกมสะสม พร้อมระบบค้นหาอัจฉริยะด้วยปัญญาประดิษฐ์ (WCO Thailand)

---

## บทที่ 1: บทนำ (Introduction)

### 1.1 ที่มาและความสำคัญของปัญหา
ในปัจจุบันตลาดการซื้อขายและประมูลการ์ดเกมสะสม (Trading Cards) มีการเติบโตอย่างรวดเร็ว อย่างไรก็ตาม แพลตฟอร์มการซื้อขายทั่วไปยังคงเผชิญกับปัญหาหลายประการ เช่น การค้นหาการ์ดที่ต้องการทำได้ยากเมื่อผู้ใช้ไม่ทราบชื่อที่แน่นอน รูปภาพสินค้าที่ถูกสร้างขึ้นหลอกลวงโดย AI (AI-Generated Images) ตลอดจนภาพถ่ายสินค้าที่มีพื้นหลังรบกวนทำให้พิจารณาสภาพการ์ดได้ยาก จากปัญหาเหล่านี้ โครงงานนี้จึงมุ่งพัฒนาระบบ WCO-Web ซึ่งเป็นเว็บแอปพลิเคชันสำหรับประมูลและซื้อขายการ์ดที่มีการนำเทคโนโลยีปัญญาประดิษฐ์ (AI) และ Computer Vision เข้ามาช่วยยกระดับประสบการณ์ของผู้ใช้งาน ทั้งในด้านการตัดขอบภาพการ์ดอัตโนมัติ การตรวจสอบภาพปลอม และการค้นหาสินค้าด้วยภาพ (Visual Search)

### 1.2 วัตถุประสงค์
1. เพื่อพัฒนาระบบเว็บไซต์สำหรับการซื้อขายและการประมูลการ์ดเกม (WCO Thailand) ที่ใช้งานง่ายและมีความปลอดภัย
2. เพื่อพัฒนาระบบสกัดภาพการ์ดจากพื้นหลัง (Automated Image Cropping) แบบอัตโนมัติ 
3. เพื่อนำเทคโนโลยี AI จาก OpenAI CLIP มาสร้างระบบค้นหาสินค้าด้วยรูปภาพที่มีความแม่นยำสูง
4. เพื่อผสานระบบตรวจสอบและคัดกรองรูปภาพที่สร้างจาก AI (AI-Generated Image Detection) ป้องกันการฉ้อโกง

### 1.3 ขอบเขตของโครงงาน
*   **ฝั่งผู้ใช้งานทั่วไป (Frontend):** รองรับระบบตะกร้าสินค้า (Cart), ระบบแจ้งเตือน (Notifications), ระบบโพสต์และประมูลสินค้า และการค้นหาสินค้าเจาะจงด้วยรูปภาพ
*   **ฝั่งการควบคุม (Backend) และ AI:** รองรับการจัดการผู้ใช้งานและการยืนยันตัวตนด้วย Supabase JWT, มีระบบสกัดขอบภาพทฤษฎี Heuristic ด้วย Emgu.CV, และการประมวลผล Image Embedding (512 มิติ) ผ่าน Python Worker
*   **ระบบฐานข้อมูล (Database):** ใช้ PostgreSQL (Supabase) และโมดูล `pgvector` ในการเก็บเวกเตอร์ภาพและการสืบค้น
*   **ระบบเชื่อมต่อภายนอก:** มีการดึง API ของ Google Lens สำหรับ Reverse Image Search และ Sightengine สำหรับตรวจจับภาพ AI ซ้อนทับ

### 1.4 ข้อจำกัด
*   ความแม่นยำในการตรวจหาขอบการ์ดอาจลดลง หากพื้นหลังมีลวดลายที่ซับซ้อนมาก หรือสภาพแสงในภาพมีความมืดเกินกว่าที่อัลกอริทึม Contrast จะจับได้
*   บริการตรวจสอบความแท้ของรูปภาพโดย Sightengine ต้องพึ่งพาการส่งค่าเครือข่ายไปยังเซิร์ฟเวอร์ภายนอก ซึ่งอาจเกิดความล่าช้า (Latency) เล็กน้อย

### 1.5 ประโยชน์ที่คาดว่าจะได้รับ
1. ผู้ใช้งานสามารถค้นหาการ์ดที่ต้องการได้รวดเร็วขึ้นผ่านรูปภาพโดยไม่ต้องรู้ชื่อการ์ด
2. ลดสถิติการฉ้อโกงในตลาดประมูลหลอกลวงผ่านขีดความสามารถในการปฏิเสธรูปภาพที่สร้างจาก AI ได้อย่างรวดเร็ว
3. แพลตฟอร์มมีความน่าเชื่อถือ พ่อค้าและผู้ประมูลสามารถนำเสนอภาพที่ถูกตัดขอบ (Crop) อย่างสวยงามและเห็นรายละเอียดของการ์ดได้ชัดเจนยิ่งขึ้น

---

## บทที่ 2: เอกสารและทฤษฎีที่เกี่ยวข้อง (Literature Review)

ในการจัดทำโครงงาน WCO-Web การรวบรวมทฤษฎีและเทคโนโลยีมีความสำคัญต่อการวางรากฐานของระบบให้มีประสิทธิภาพสูงสุด:

### 2.1 ทฤษฎีเกี่ยวกับระบบ e-Commerce และการประมูล
*   **ระบบการซื้อขาย (Marketplace):** โครงสร้างของการเสนอราคา (Bidding) และการจับเวลาในการสิ้นสุดการประมูล รวมถึงระบบแจ้งเตือนแบบเรียลไทม์เพื่อรักษาความต่อเนื่องของผู้ใช้

### 2.2 เทคโนโลยีและเครื่องมือที่ใช้
**ระบบ Frontend (ส่วนติดต่อผู้ใช้งาน):**
*   **React & Node.js:** ไลบรารีหลักในการสร้าง User Interface เน้นความเร็วร่วมกับ React Router ในการสลับหน้า
*   **TailwindCSS & DaisyUI:** ใช้จัดระเบียบโครงสร้าง UI แบบ Utility-first ช่วยให้เขียน CSS ได้สวยงามและปรับตัวเชิง Responsive ได้ง่ายรวดเร็ว

**ระบบ Backend (ส่วนจัดการทราฟฟิก):**
*   **ASP.NET Core (C#):** ถือตรรกะระดับกลาง (Middleware) ใช้ประมวลผล API, จัดการ Authorization JWT และการรับส่งข้อมูลรูปภาพ 
*   **Emgu.CV:** ไลบรารีคอมพิวเตอร์วิทัศน์ที่ถูกอิมพอร์ตเข้าไปใน C# สำหรับสร้างขั้นตอนการครอปภาพการ์ดแบบ 6 กระบวนท่าอัตโนมัติ

**ระบบ AI (Image Processor Worker):**
*   **Python & FastAPI:** สร้างระบบ Microservice สำหรับโหลดโมเดลทางคณิตศาสตร์
*   **OpenAI CLIP (ViT-B-32):** โมเดลสำหรับวิเคราะห์แยกแยะโครงสร้างของรูปภาพและคายผลลัพธ์เป็นเวกเตอร์ 512 มิติ (512-Dimensional Vector Array) มาเพื่อทำการเปรียบเทียบคะแนนความเหมือนแบบ Cosine Similarity 

**ระบบฐานข้อมูล (Database):**
*   **Supabase (PostgreSQL + pgvector):** บริการฐานข้อมูลแบบ Cloud ที่มี Extension ของ pgvector ทำหน้าที่หาค่าการตีกรอบเวกเตอร์ที่ใกล้เคียงกันที่สุด (Nearest Neighbor)

### 2.3 งานวิจัยหรือระบบที่ใกล้เคียง
*   ระบบส่วนนี้ได้นำแนวคิด Google Lens (Reverse Image Search) มาสร้างกลไกย่อยส่วนตัวเฉพาะกลุ่มฐานข้อมูลการ์ดของเราเอง แทนที่จะพึ่งพา Database โลก ก็ใช้งาน Vector DB เปรียบเทียบสินค้าภายในเว็บไซต์ 

---

## บทที่ 3: วิธีดำเนินงาน (Methodology)

บทนี้นำเสนอขั้นตอนการดำเนินงานของโครงงาน WCO-Web ตั้งแต่กระบวนการออกแบบสถาปัตยกรรมระบบ การเลือกเครื่องมือและเทคโนโลยีที่ใช้พัฒนา ไปจนถึงการสร้างและทดสอบโมดูลสำคัญแต่ละส่วน โดยยึดกรอบแนวคิดการพัฒนาซอฟต์แวร์แบบ **Agile** ในการแบ่งงานออกเป็น Sprint เพื่อควบคุมคุณภาพและส่งมอบฟีเจอร์ได้อย่างต่อเนื่อง

---

### 3.1 กระบวนการดำเนินงานโดยรวม (Overall Development Process)

โครงงานนี้แบ่งการพัฒนาออกเป็น **4 ระยะ (Phase)** หลัก โดยแต่ละระยะจะดำเนินการต่อเนื่องกันและมีผลลัพธ์ที่วัดได้ชัดเจน ดังนี้:

| ระยะ | กิจกรรมหลัก | ผลลัพธ์ที่ได้ |
|---|---|---|
| Phase 1 | รวบรวมความต้องการ, ออกแบบ ER-Diagram, เลือกสแตค | Architecture Blueprint |
| Phase 2 | พัฒนา Frontend (React), Backend (ASP.NET Core), ฐานข้อมูล (Supabase) | ระบบตลาด-ประมูลที่ใช้งานได้ |
| Phase 3 | พัฒนา Python CLIP Worker, CardDetection, Image Moderation | โมดูล AI ครบ 3 ชุด |
| Phase 4 | Black-box / White-box Testing, SUS Usability Survey | รายงานผลทดสอบ |

---

### 3.2 สภาพแวดล้อมการพัฒนาและเครื่องมือ (Development Environment & Tools)

#### 3.2.1 ซอฟต์แวร์และ Framework ที่เลือกใช้

| บทบาท | เทคโนโลยีที่เลือกใช้ | เหตุผลในการเลือก |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite | Component-based, Hot-reload เร็ว, Ecosystem กว้าง |
| **UI Library** | TailwindCSS + DaisyUI | Utility-first, ลด CSS custom ให้น้อยลง |
| **Backend** | ASP.NET Core 8 (C#) | Performance สูง, Middleware Pipeline ยืดหยุ่น, Strongly-typed |
| **Computer Vision** | Emgu.CV 4.x (OpenCV .NET Binding) | ครอบคลุม Algorithm CV ครบ, รันบน Server ไม่ต้องการ GPU |
| **AI Worker** | Python 3.11 + FastAPI + open_clip | CLIP model รัน CPU/GPU ได้, FastAPI async สูง |
| **ฐานข้อมูล** | Supabase (PostgreSQL 15 + pgvector) | Managed DB, Auth built-in, Extension pgvector สำหรับ Vector Search |
| **External API** | SerpAPI (Google Lens), Sightengine | Reverse Image Search และตรวจ AI-Generated Image |

#### 3.2.2 โครงสร้างโฟลเดอร์โปรเจค (Repository Structure)

โครงงานแบ่งโค้ดออกเป็น 3 Workspace หลักที่ทำงานเป็นอิสระแต่ติดต่อกันผ่าน HTTP API ตามสถาปัตยกรรม **Microservices**:

```
WCO-Web/
├── client-web/          ← React Frontend (Port 5173)
│   ├── src/pages/       ← หน้าเว็บแต่ละส่วน (Home, PostDetail, Search ฯลฯ)
│   └── src/api/         ← ฟังก์ชัน Axios เชื่อมต่อ Backend
│
├── server-api/          ← ASP.NET Core Backend (Port 7001)
│   ├── Controllers/     ← Endpoint รับ HTTP Request
│   └── Services/        ← Business Logic (CardDetection, ClipEmbedding ฯลฯ)
│
└── clip-worker/         ← Python FastAPI AI Worker (Port 5000)
    └── main.py          ← โหลด CLIP Model และ expose /embed endpoint
```

---

### 3.3 การออกแบบสถาปัตยกรรมระบบ (System Architecture Design)

#### 3.3.1 ภาพรวมสถาปัตยกรรม (High-Level Architecture)

ระบบออกแบบตามแนวคิด **3-Tier Architecture** ที่มีโมดูล AI เพิ่มเติมเป็น Microservice แยกต่างหาก โดยแต่ละ Service มีความรับผิดชอบเฉพาะ (Separation of Concerns) และ Backend ออกแบบให้ Stateless ใช้ JWT ยืนยันตัวตนใน Header ทุก Request

**1. Use Case Diagram:**
*   **User/Buyer:** สามารถ Login, ดูสินค้า, ประมูล (Bid), สั่งซื้อ, ค้นหาด้วยรูปภาพ
*   **Seller:** เหมือน User แต่สามารถสร้างโพสต์สินค้า, จัดการ Order และตะกร้า
*   **Admin:** ตรวจสอบผู้ใช้งาน, จัดการ Role, กำกับดูแลโพสต์ที่เข้าข่ายมิจฉาชีพ

**2. Sequence Diagram (ระบบค้นหาด้วยภาพ):**
*   `Client` อัปโหลดภาพ → `server-api` ตัดภาพด้วย Emgu.CV และรันตรวจภาพปลอม → `clip-worker` สกัดเวกเตอร์ 512 มิติ $\mathbb{R}^{512}$ → `Supabase (pgvector)` คืนสินค้าที่แมทช์เรียงตาม Similarity Score → `Client` แสดงผล

**3. Entity Relationship Diagram (ER-Diagram) — ตารางหลัก:**

| ตาราง | คอลัมน์สำคัญ | บทบาท |
|---|---|---|
| `profiles` | `id`, `display_name`, `role` | ข้อมูลผู้ใช้และสิทธิ์ |
| `posts` | `id`, `title`, `price`, `status`, `category` | ข้อมูลสินค้า |
| `post_image_embeddings` | `post_id`, `embedding` (vector 512) | เวกเตอร์ภาพสำหรับ Visual Search |
| `cart` / `cart_items` | `user_id`, `post_id`, `quantity` | ตะกร้าสินค้า |
| `notifications` | `user_id`, `type`, `payload` | การแจ้งเตือน Real-time |

#### 3.3.2 การออกแบบ Vector Column ด้วย pgvector

ตาราง `post_image_embeddings` ออกแบบรองรับ Vector Search ด้วย Extension `pgvector` และ HNSW Index เพื่อให้การค้นหา Approximate Nearest Neighbor ทำงานในความเร็ว $O(\log n)$:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE post_image_embeddings (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "postId"      uuid REFERENCES posts(id) ON DELETE CASCADE,
    embedding     vector(512),
    source_image_url text,
    card_index    int DEFAULT 0
);

-- HNSW Index: m=16 (links per node), ef_construction=64 (build candidate pool)
CREATE INDEX idx_post_image_embeddings_embedding
    ON post_image_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```

#### 3.3.3 การออกแบบ API Endpoints (REST API Design)

Backend ออกแบบ Endpoint ตามหลัก RESTful แบ่งตาม Controller:

| Controller | Endpoint | บทบาท |
|---|---|---|
| `PostsController` | `GET /api/posts`, `POST /api/posts` | จัดการข้อมูลโพสต์สินค้า |
| `CardDetectionController` | `POST /api/card-detection/analyze` | ครอปการ์ด + ตรวจสอบ AI |
| `CardDetectionController` | `POST /api/card-detection/search` | ค้นหาโพสต์ด้วยภาพ (Visual Search) |
| `CartController` | `POST /api/cart`, `DELETE /api/cart/{id}` | จัดการตะกร้าสินค้า |
| `NotificationsController` | `GET /api/notifications` | ดึงการแจ้งเตือน |

---

### 3.4 การพัฒนาระบบหลัก (Core System Development)

#### 3.4.1 การพัฒนา Frontend (React Web Application)

**ขั้นตอนการพัฒนา:**
1. สร้างโปรเจคด้วย Vite + React + TypeScript template และติดตั้ง Dependencies หลัก ได้แก่ `axios`, `react-router-dom`, `@supabase/supabase-js`
2. ออกแบบ Routing ด้วย `react-router-dom` ครอบคลุมหน้า: หน้าหลัก (`/`), รายละเอียดสินค้า (`/post/:id`), ค้นหาด้วยภาพ (`/search`), สร้างโพสต์ (`/create-post`)
3. สร้าง API Layer ใน `src/api/` รวม Logic การยิง HTTP Request ไว้ที่เดียว
4. ระบบ Authentication ใช้ `@supabase/supabase-js` เชื่อมกับ Supabase Auth โดยตรง และนำ JWT Token แนบใน `Authorization: Bearer` Header ทุก Request ส่งไป `server-api`

#### 3.4.2 การพัฒนา Backend API (ASP.NET Core)

**การตั้งค่าระบบ Authentication:**

Backend ตั้งค่า `AddAuthentication` ให้รู้จัก JWT ของ Supabase โดยใช้ JWKS Endpoint ดึง Public Key มาตรวจสอบ Signature พร้อมเพิ่ม Middleware สกัด `sub` Claim แปะเป็น Header `X-User-Id` ให้ Controllers ใช้งาน

**การออกแบบ Service Layer:**

Business Logic ทั้งหมดแยกจาก Controller ด้วยหลัก **Dependency Injection** ลงทะเบียนใน `Program.cs`:

```csharp
builder.Services.AddScoped<ICardDetectionService, CardDetectionService>();
builder.Services.AddScoped<IClipEmbeddingService, ClipEmbeddingService>();
builder.Services.AddScoped<IPostModerationAiService, PostModerationAiService>();
```

---

### 3.5 การพัฒนาโมดูล AI ประมวลผลภาพ (AI Image Processing Modules)

ส่วนนี้เป็นหัวใจหลักของโครงงาน แบ่งออกเป็น **3 โมดูล** ที่ทำงานต่อกันเป็น Pipeline:

```
รูปภาพที่ผู้ใช้อัปโหลด
        │
        ▼
[โมดูล 1] CardDetectionService  →  ครอปการ์ดออกจากพื้นหลัง (Emgu.CV 6 ขั้น)
        │
        ▼
[โมดูล 2] ImageManipulationDetection + Sightengine  →  ตรวจสอบภาพปลอม/ภาพ AI
        │
        ▼
[โมดูล 3] CLIP Embedding + pgvector  →  สร้าง/ค้นหาเวกเตอร์ภาพ
```

#### 3.5.1 โมดูลที่ 1: การตรวจจับและครอปภาพการ์ดอัตโนมัติ (CardDetectionService.cs)

โมดูลนี้ใช้ไลบรารี **Emgu.CV** ดำเนินการวิเคราะห์และสกัดพื้นที่ของการ์ดออกจากภาพถ่ายด้วย **Heuristic 6 ขั้นตอน**:

*   **ขั้นที่ 0 — Color Background Segmentation:** สุ่มตัวอย่างพิกเซลจากขอบทั้ง 4 ด้านประมาณสีพื้นหลังในปริภูมิ HSV สร้าง Binary Mask โดยพิกเซลที่ระยะสีถ่วงน้ำหนักเกิน 35 หน่วยจากค่าเฉลี่ยขอบถือเป็น Foreground
*   **ขั้นที่ 1 — Projection Grid Detection:** คำนวณ Sobel Gradient แล้วฉาย Projection Profile เพื่อหาช่องว่างระหว่างการ์ด แบ่งพิกัดเป็น Grid Cell และตรวจ Aspect Ratio ว่าตรงกับ $\approx 0.714$
*   **ขั้นที่ 2 — Multi-Scale Contour Detection:** รันที่ 3 สเกล (100%, 75%, 50%) ด้วย Histogram Equalization → Gaussian Blur → Adaptive Threshold → Adaptive Canny → FindContours กรองสี่เหลี่ยมที่ Aspect Ratio อยู่ในช่วง 0.50–0.92
*   **ขั้นที่ 3 — Grid Completion:** อนุมานช่องการ์ดที่หายจากช่องที่พบแล้ว ป้องกันพลาดการ์ดที่ถูกบังบางส่วน
*   **ขั้นที่ 4 — Scoring:** ให้คะแนนผู้สมัครแต่ละรายด้วย 3 มิติ: **Texture Score** (StdDev ของ Gradient), **MSER Text-Likelihood Score** (ตรวจจับ Region คล้ายตัวอักษร), **Border Contrast Score** (ความแตกต่างสีขอบใน-นอก) สูตรรวม:
$$\text{score} = \text{TextureScore} \times (0.40 + 0.35 \times \text{AspectFit} + 0.25 \times \text{TextLikelihood}) \times \text{TextGate} \times \text{BorderGate}$$
*   **ขั้นที่ 5 — Deduplication & Final Crop:** ตัดกรอบที่ Overlap > 25% กรองขนาดน้อยกว่า 28% ของ Median Area เพิ่ม Padding 1.2% แล้ว Encode เป็น Base64 JPEG

#### 3.5.2 โมดูลที่ 2: การตรวจสอบภาพตัดต่อและภาพ AI (Image Moderation)

โมดูลนี้ทำงาน 2 ชั้นคู่ขนาน:

**ชั้นที่ 1 — Local Heuristic Analysis (`ImageManipulationDetectionService.cs`):** วิเคราะห์ **17 สัญญาณสถิติ** โดยไม่ต้องใช้ GPU:
*   *สัญญาณตรวจภาพตัดต่อ (11 ชนิด):* Multi-level ELA, Color Channel Correlation (Pearson), JPEG Ghost, Wavelet Noise Inconsistency และอื่นๆ
*   *สัญญาณตรวจภาพ AI (6 ชนิด):* Multi-scale Noise Floor, High-Frequency Ratio, Color Palette Uniformity และอื่นๆ

ค่าดิบแปลงเป็นเปอร์เซ็นต์ด้วย **Sigmoid Normalization** รวมด้วย **Weighted Average** และคูณ **Concordance Factor** (IQR-based) ปรับค่าตามระดับการเห็นตรงกันของสัญญาณ

**ชั้นที่ 2 — External Deep Learning (Sightengine API):** ยืนยันซ้ำด้วยโมเดล CNN เพื่อลด False Negative

**Logic การตัดสินใจ:**
```
aiGenRisk >= 52 AND > manipRisk + 6   →  "ai-generated"
manipRisk >= 52 AND > aiGenRisk + 6   →  "manipulation"
aiGenRisk >= 38 OR  manipRisk >= 38   →  "mixed-signals"
```

#### 3.5.3 โมดูลที่ 3: ระบบค้นหาด้วยรูปภาพ (Visual Search via CLIP + pgvector)

**Python CLIP Worker (`clip-worker/main.py`):** FastAPI Service โหลดโมเดล **CLIP ViT-B/32** ผ่าน `open_clip` expose Endpoint `POST /embed` รับ List ของ Base64 Image คืน float[512] ต่อรูป โดย L2 Normalize ทุก Vector ก่อนส่งกลับ ทำให้ Cosine Similarity ลดรูปเป็น Dot Product:
$$\text{Cosine Similarity}(A, B) = A \cdot B \quad \text{(เมื่อ } \|A\| = \|B\| = 1\text{)}$$

**ขั้นตอนสร้าง Index (เมื่อผู้ขายสร้างโพสต์):** Background Task ดาวน์โหลดรูป → ครอปการ์ด → ส่ง CLIP Worker → Insert float[512] ลงตาราง `post_image_embeddings`

**ขั้นตอนค้นหา (เมื่อผู้ใช้ค้นหา):** ครอปการ์ดจากรูปผู้ใช้ → CLIP Worker → RPC `match_posts_by_embedding` (threshold=0.70) → Supabase HNSW ค้นหา Nearest Neighbor → เรียง Score → ส่งกลับ Frontend

**ฟังก์ชัน PostgreSQL สำหรับ Vector Search:**
```sql
RETURN QUERY
SELECT e."postId",
       (1 - (e.embedding <=> v))::double precision AS score
FROM post_image_embeddings e
INNER JOIN posts p ON p.id = e."postId"
WHERE p.status = match_status
  AND (1 - (e.embedding <=> v)) >= match_threshold
ORDER BY e.embedding <=> v
LIMIT match_limit;
```

#### 3.5.4 โมดูลเสริม: Reverse Image Search ด้วย Google Lens

`ExternalReverseImageService.cs` ส่ง URL รูปไปยัง **SerpAPI (Google Lens, mode = exact_matches)** ตรวจสอบว่ารูปปรากฏบน Mercari, Yahoo Auctions JP, Magi หรือไม่ ยืนยันซ้ำด้วย **dHash (Perceptual Hash)** และ **CLIP Cosine Similarity** เพื่อแยกแยะ "รูปขโมยมา" กับ "การ์ดชนิดเดียวกัน":
*   พบบน Marketplace เป้าหมาย ≥ 1 ลิงก์ → Risk 73–85%
*   dHash Hamming Distance ≤ 12/64 bit → ยืนยัน Exact Match

---

### 3.6 การผสานโมดูลและการบูรณาการระบบ (System Integration)

#### 3.6.1 Pipeline เมื่อสร้างโพสต์ใหม่

```
ผู้ขายกรอกฟอร์มและแนบรูป → Frontend POST /api/card-detection/analyze
→ CardDetectionService (Emgu.CV Crop) → ImageManipulationDetection (17 signals)
→ Sightengine API → Google Lens/SerpAPI
→ JSON: { manipulationWarning, aiWarning, reverseImageWarning } → Frontend ยืนยัน
→ POST /api/posts → Background CLIP Indexing (async)
```

#### 3.6.2 Pipeline เมื่อค้นหาด้วยรูปภาพ

```
ผู้ใช้อัปโหลดรูป → POST /api/card-detection/search
→ CardDetectionService (Crop max 12 ใบ) → ClipEmbeddingService (Batch to Python)
→ Python CLIP ViT-B/32 (float[512] × N) → Supabase RPC match_posts_by_embedding
→ HNSW ANN Search → (postId, score) → Fetch ข้อมูลโพสต์ เรียง Score → Frontend
```

---

### 3.7 การตั้งค่าพารามิเตอร์สำคัญของระบบ (Configuration)

ค่าพารามิเตอร์ Algorithm Computer Vision ที่สำคัญ:

| พารามิเตอร์ | ค่า | ความหมาย |
|---|---|---|
| `CardAspect` | 0.714 (2.5/3.5) | อัตราส่วนมาตรฐาน Trading Card |
| `MinAspectRatio` / `MaxAspectRatio` | 0.50 – 0.92 | ช่วงยอมรับความคลาดเคลื่อนจากมุมถ่าย |
| `match_threshold` | 0.70 | Cosine Similarity ขั้นต่ำสำหรับ Visual Search |
| `MaxCardsReturned` | 24 | การ์ดสูงสุดต่อรูปภาพ |
| `CropPaddingFraction` | 1.2% | Padding ขอบการ์ดก่อน Crop |

---

### 3.8 เครื่องมือและขั้นตอนการทดสอบ (Testing Approach)

การทดสอบระบบแบ่งออกเป็น 3 ระดับ:

1. **Unit / Integration Testing:** ทดสอบฟังก์ชันหน่วยของ Backend ผ่าน Postman กับชุดรูปทดสอบ 20 รูป ตรวจสอบผลลัพธ์ CardDetection, ImageManipulation, และ CLIP Embedding
2. **Black-box Testing:** ทดสอบจากมุมผู้ใช้งาน: ล็อกอินด้วยข้อมูลผิด → ตรวจ 401, อัปโหลดรูป Midjourney → ตรวจว่าระบบปฏิเสธ, ค้นหาด้วยรูปการ์ด → ตรวจผลลัพธ์ Sort by Score
3. **SUS Usability Testing:** แจกแบบสอบถาม System Usability Scale (SUS) ให้กลุ่มผู้ทดสอบ เงื่อนไขบรรลุผล: SUS Score เฉลี่ย > 70 คะแนน (ระดับ Acceptable)

---

## บทที่ 4: ผลการดำเนินงาน (Implementation and Testing)

บทนี้จะนำเสนอผลลัพธ์จากการพัฒนาระบบ WCO-Web โดยแบ่งออกเป็นส่วนของหน้าจอการทำงานจริงของฟังก์ชันต่างๆ ตลอดจนผลการทดสอบระบบและผลการประเมินจากผู้ใช้งาน

### 4.1 ส่วนของหน้าจอจริงและการทำงานของระบบ (System Implementation Results)
ในส่วนนี้จะแสดงภาพหน้าจอ (Screenshot) และอธิบายการทำงานของระบบในแต่ละส่วนที่พัฒนาสำเร็จ ดังนี้:

#### 4.1.1 การสมัครสมาชิก (User Registration)
*(ผู้จัดทำสามารถแทรกภาพหน้าจอการสมัครสมาชิกและการยืนยันตัวตน)*
*   หน้าต่างฟอร์มสำหรับกรอกข้อมูลผู้ใช้งานใหม่ รูปแบบการตรวจสอบข้อมูลเบื้องต้น และกระบวนการสร้างบัญชีผู้ใช้ลงในระบบฐานข้อมูล Supabase

#### 4.1.2 การเข้าระบบ (User Login)
*(ผู้จัดทำสามารถแทรกภาพหน้าจอการเข้าสู่ระบบเข้าใช้งาน)*
*   หน้าจอสำหรับกรอกอีเมลและรหัสผ่าน การจัดการสถานะการเข้าสู่ระบบ และการแสดงผลเมื่อผู้ใช้งานกรอกข้อมูลผิดพลาด

#### 4.1.3 การใช้งานเว็บแอปพลิเคชัน (Web Application Usage)
*(ผู้จัดทำสามารถแทรกภาพหน้าแรก, หน้าโปรไฟล์, การดูตะกร้าสินค้า หรือส่วนต่างๆ ทั่วไป)*
*   ภาพรวมของหน้าแรก (Homepage) การแสดงผลรายการสินค้าที่กำลังเปิดให้ประมูล และการนำทางไปยังหน้าต่างๆ ของเว็บไซต์ที่ถูกออกแบบมาให้รองรับ Responsive Design

#### 4.1.4 การสร้างโพสสินค้า (Creating Product Posts)
*(ผู้จัดทำสามารถแทรกภาพหน้าฟอร์มสร้างโพสต์และอัปโหลดรูปภาพ)*
*   ขั้นตอนที่ผู้ขายทำการกรอกรายละเอียดการ์ด อัปโหลดรูปภาพสินค้า รวมถึงระบบการประมวลผลพื้นหลังแบบอัตโนมัติ (Automated Image Cropping) ก่อนนำข้อมูลเข้าสู่ระบบ

#### 4.1.5 ระบบการจัดการสินค้า คำร้อง และผู้ใช้งาน (Management System)
*(ผู้จัดทำสามารถแทรกภาพหน้ากระดานควบคุมสำหรับผู้ดูแลหน้าเว็บและผู้ใช้งาน)*
*   หน้าจอสำหรับการจัดการออเดอร์ การสั่งซื้อ การยื่นคำร้องต่างๆ รวมถึงระบบควบคุมและหน้าจอ Admin สำหรับดูแลโพสต์และแบนผู้ใช้งานที่กระทำผิด

#### 4.1.6 ระบบตรวจสอบภาพ (Image Verification System)
*(ผู้จัดทำสามารถแทรกภาพหน้าแสดงผลการแจ้งเตือน AI สแกนหรือภาพถ่าย/ภาพตัดต่อ)*
*   ผลลัพธ์การทำงานของระบบตรวจสอบและคัดกรองรูปภาพที่สร้างจาก AI (AI-Generated Image Detection) และภาพตัดต่อ ซึ่งระบบจะแจ้งเตือนเมื่อพบความเสี่ยงสูงจากสัญญาณ Heuristic หรือโมเดลภายนอก

#### 4.1.7 ระบบค้นหาโพสด้วยรูปภาพ (Image-Based Search System)
*(ผู้จัดทำสามารถแทรกภาพหน้าค้นหาด้วยภาพและผลลัพธ์ที่ได้จากการค้นหา)*
*   หน้าตาฟังก์ชันการค้นหาสินค้าด้วยรูปภาพ (Visual Search) ที่แสดงผลการดึงข้อมูลการ์ดใบที่เหมือนกันหรือใกล้เคียงที่สุดให้ขึ้นมาแสดงผลตามค่าความเหมือน (Cosine Similarity)

### 4.2 การทดสอบระบบ (System Testing)
*   **Black Box Testing:** ทดสอบการเข้าสู่ระบบผ่านการสุ่มกรอกข้อผิดพลาด ระบบจะแจ้งเตือน 401 Unauthorized รวมถึงหน้า UI ยืนยันผลลัพธ์ของโมเดลภายนอก หากอัปโหลดภาพที่ Generate ด้วย AI ระบบจะปฏิเสธหน้าการสร้างโพสต์
*   **White Box Testing:** ติดตามและตรวจสอบ Code ในระดับ Function ขจัดปัญหาข้อผิดพลาด (เช่น ปัญหาของการทำ RPC Overloading ที่เกิดใน Supabase และการกำหนดสิทธิ์ JWT Authorization)

### 4.3 ผลการประเมินจากผู้ใช้งาน (Usability Testing)
นำแบบประเมิน System Usability Scale (SUS) ไปแจกจ่ายให้กลุ่มผู้ทดลองระบบ เพื่อเก็บผลและวิเคราะห์ทางสถิติว่าแอปพลิเคชันนี้ใช้งานง่ายเพียงใด รวมไปถึงประสิทธิภาพของฟังก์ชันตัดขอบการ์ดและการค้นหาด้วยรูปภาพว่าสามารถตอบโจทย์การใช้งานจริงได้ตามสมมติฐาน (อ้างอิงจากเกณฑ์ที่กำหนดไว้คือ >70 คะแนน)

---

## บทที่ 5: สรุปผลและข้อเสนอแนะ (Conclusion and Suggestions)

### 5.1 สรุปผลการดำเนินงาน
โครงการระบบประมูลการ์ด WCO-Web สามารถดำเนินการได้ครอบคลุมขอบเขตที่ตั้งไว้ กล่าวคือระบบทำงานแบบ Full-Stack เต็มรูปแบบสามารถใช้ตะกร้า แจ้งเตือน อัปโหลดรูปแบบฟอร์มอัตโนมัติ โดยเฉพาะระบบส่วนกลาง (Core AI Service) สามารถแยกแยะพิกัดมุมของเส้นการ์ด และวัดค่าของ Cosine Similarity ในการค้นหาการ์ดจากภาพถ่ายที่มีความละเอียดและมีความยืดหยุ่นสูง

### 5.2 ปัญหาและอุปสรรค
ระหว่างการพัฒนาพบเจอปัญหาสำคัญดังนี้:
1. ปัญหาคอขวด (Bottleneck) ตอนอัปโหลดรูป ที่เคยช้า เนื่องจากไปรอผลสกัด AI: **วิธีแก้** แยกกระบวนการด้วยระบบ Background Service และทำ Microservice ฝั่ง Python ขนานกัน
2. ปัญหาฟังก์ชัน RPC ของ Supabase (PGRST203): การมีฟังก์ชันชื่อตรงกันและ Arguments คล้ายกันก่อให้เกิด Overloading Error: **วิธีแก้** ลบ Schema ที่ชนกันด้วย `DROP FUNCTION` แบบเจาะจง Param ในการแก้ไข Migration
3. ปัญหา JWT Unauthorized (401/403): การส่งค่า Header ไม่สมดุล และ C# ตีความ Token ผิดในส่วนของการอ้าง Access : **วิธีแก้** เพิ่ม Custom Header `X-User-Id` และจูนพารามิเตอร์ Authentication Builders 

### 5.3 ข้อเสนอแนะเพื่อการพัฒนาต่อ
*   เพิ่มขีดความสามารถของโมเดล AI ในการจัดลำดับ (Grade Condition) ความสมบูรณ์ของการ์ดว่ามีรอยถลอกหรือโค้งงอมากน้อยระดับใด
*   พัฒนาระบบบอทแนะนำราคากลาง (Price Tracker) สำหรับการประมูลขั้นต่ำ

---

## บรรณานุกรม (Bibliography)
*   Supabase Documentation (pgvector and Auth).
*   OpenAI CLIP model theory: Radford, A., et al. (2021). "Learning Transferable Visual Models From Natural Language Supervision."
*   Emgu.CV Computer Vision guide for C# ASP.NET Core. 
*   Microsoft Docs: ASP.NET Core Middleware & Authentication Systems.

---

## ภาคผนวก (Appendix)
*(ส่วนนี้เสริมไฟล์คู่มือ หรือซอร์สโค้ดเฉพาะที่สำคัญ)*
*   เอกสาร AI_WORKFLOW_AND_THEORY.md 
*   สคริปต์ Database Schema Migration `supabase-image-embeddings-setup.sql` 
*   ภาพการกำหนดโฟลเดอร์ฝั่ง Backend และ Python Worker
