# นวนิพนธ์ / ปริญญานิพนธ์ (Thesis) 
**หัวข้อ:** การพัฒนาระบบประมูลและซื้อขายการ์ดเกมสะสม พร้อมระบบค้นหาอัจฉริยะด้วยปัญญาประดิษฐ์ (WCO Thailand)

---

## บทที่ 1: บทนำ (Introduction)

### 1.1 ที่มาและความสำคัญของปัญหา
ในปัจจุบันตลาดการซื้อขายและประมูลการ์ดเกมสะสม (Trading Cards) มีการเติบโตอย่างรวดเร็ว อย่างไรก็ตาม แพลตฟอร์มการซื้อขายทั่วไปยังคงเผชิญกับปัญหาหลายประการ เช่น การค้นหาการ์ดที่ต้องการทำได้ยากเมื่อผู้ใช้ไม่ทราบชื่อที่แน่นอน รูปภาพสินค้าที่ถูกสร้างขึ้นหลอกลวงโดย AI (AI-Generated Images) ตลอดจนการขโมยรูปภาพสินค้าจากเว็บไซต์ต่างประเทศ เช่น Mercari หรือ Yahoo Auctions JP มาแอบอ้างขายเป็นของตนเอง จากปัญหาเหล่านี้ โครงงานนี้จึงมุ่งพัฒนาระบบ WCO-Web ซึ่งเป็นเว็บแอปพลิเคชันสำหรับประมูลและซื้อขายการ์ดที่มีการนำเทคโนโลยีปัญญาประดิษฐ์ (AI) และ Computer Vision เข้ามาช่วยยกระดับประสบการณ์ของผู้ใช้งาน ทั้งในด้านการตัดขอบภาพการ์ดอัตโนมัติ การตรวจสอบภาพปลอม และการค้นหาสินค้าด้วยภาพ (Visual Search)

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
├── client-web/          ← React Frontend (Port 3000)
│   ├── src/pages/       ← หน้าเว็บแต่ละส่วน (Home, PostDetail, Search ฯลฯ)
│   └── src/api/         ← ฟังก์ชัน Axios เชื่อมต่อ Backend
│
├── server-api/          ← ASP.NET Core Backend (Port 5000)
│   ├── Controllers/     ← Endpoint รับ HTTP Request
│   └── Services/        ← Business Logic (CardDetection, ClipEmbedding ฯลฯ)
│
└── clip-worker/         ← Python FastAPI AI Worker (Port 5002)
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
→ CardDetectionService (Emgu.CV Crop) → คืนภาพการ์ดที่ตัดขอบแล้ว
→ Frontend แสดง Preview → ผู้ขายยืนยัน → POST /api/posts
→ Background CLIP Indexing (async): ดาวน์โหลดรูป → ครอปการ์ด → CLIP Worker → Insert Embedding
```

#### 3.6.2 Pipeline การตรวจสอบภาพโดยแอดมิน (Admin Image Moderation)

ระบบตรวจสอบภาพ (Image Moderation) **ไม่ได้ทำงานอัตโนมัติ** ในขั้นตอนสร้างโพสต์ แต่เป็นเครื่องมือที่ **ผู้ดูแลระบบ (Admin) เรียกใช้งานด้วยการกดปุ่ม** บนหน้ารายละเอียดโพสต์ (PostDetail) เมื่อพบโพสต์ที่น่าสงสัย:

```
Admin เข้าหน้า PostDetail → กดปุ่ม "ตรวจสอบภาพตัดต่อ" หรือ "ตรวจสอบภาพ AI"
→ POST /api/admin/ai-screening?type=manipulation หรือ type=ai-generated
→ ImageManipulationDetection (17 signals) + Sightengine API
→ JSON: { manipulationRisk, aiGeneratedRisk, verdict } → แสดงผลให้ Admin ตัดสินใจ

Admin กดปุ่ม "ตรวจสอบแหล่งที่มา" 
→ POST /api/admin/reverse-image-search
→ Google Lens/SerpAPI → dHash + CLIP Similarity ยืนยัน
→ JSON: { reverseImageRisk, matchedLinks } → Admin ตัดสินใจอนุมัติ/ปฏิเสธโพสต์
```

#### 3.6.3 Pipeline เมื่อค้นหาด้วยรูปภาพ

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

บทนี้เป็นการนำเสนอผลลัพธ์จากการพัฒนาระบบ WCO-Web ซึ่งประกอบไปด้วยส่วนติดต่อผู้ใช้งาน (Frontend) และส่วนประมวลผลการทำงานเบื้องหลัง (Backend และ AI Worker) โดยนำเสนอการทำงานจริงของระบบตามขอบเขตและวัตถุประสงค์ที่ได้กำหนดไว้ในบทที่ 1 รวมถึงการรายงานผลการทดสอบประสิทธิภาพของฟังก์ชันต่างๆ และผลการประเมินความพึงพอใจจากกลุ่มผู้ทดลองใช้งาน

### 4.1 ส่วนของหน้าจอจริงและการทำงานของระบบ (System Implementation Results)

การแสดงผลการดำเนินงานของระบบ WCO-Web จะแบ่งออกตามฟังก์ชันการทำงานหลักของระบบ ดังต่อไปนี้:

#### 4.1.1 การสมัครสมาชิก (User Registration)
ระบบการสมัครสมาชิกถูกออกแบบให้มีความปลอดภัยและใช้งานง่าย โดยเชื่อมต่ออินเตอร์เฟซเข้ากับบริการ Supabase Authentication 
*   **การทำงาน:** ผู้ใช้งานใหม่จะต้องกรอกข้อมูลพื้นฐานในฟอร์มสมัครสมาชิก ได้แก่ ชื่อผู้ใช้งาน (Display Name), อีเมล, และรหัสผ่านที่ต้องผ่านเกณฑ์ความปลอดภัย
*   **กระบวนการตรวจสอบ:** ระบบมีการป้องกันการตั้งชื่อผู้ใช้งานซ้ำ (Unique Profile Name Validation) โดยจะดึงข้อมูลจากฐานข้อมูลมาตรวจสอบแบบเรียลไทม์ หากชื่อถูกกำหนดไว้แล้วในระบบจะแสดงข้อความแจ้งเตือนสีแดง และเมื่อข้อมูลตัวเลขถูกต้อง ข้อมูลเบื้องต้นจะถูกเข้ารหัสระดับสูงและนำไปบันทึกลงในระบบเพื่อสร้าง Profile ทันที
*(ผู้จัดทำสามารถแทรกภาพหน้าจอ: หน้าฟอร์มการสมัครสมาชิก และกล่องข้อความแจ้งเตือนข้อผิดพลาดเกี่ยวกับการตั้งชื่อซ้ำ หรือกรอกรหัสผ่านไม่ตรงเกณฑ์)*

#### 4.1.2 การเข้าระบบ (User Login)
ระบบการเข้าสู่ระบบถูกควบคุมการรักษาความปลอดภัยด้วยเทคโนโลยี JSON Web Token (JWT) เพื่อจัดการเซสชันการเข้าถึงของผู้ใช้งานอย่างเคร่งครัด
*   **การทำงาน:** ผู้ใช้งานต้องกรอกอีเมลและรหัสผ่าน หากข้อมูลป้อนเข้าถูกต้อง Backend จะจับคู่ข้อมูลกับฐานข้อมูลและสร้าง JWT ส่งกลับไปยังเบราว์เซอร์เพื่อจัดเก็บในรูปแบบการรักษาความปลอดภัย
*   **การจัดการข้อผิดพลาด:** ในกรณีที่ผู้ใช้อีเมลหรือรหัสผ่านไม่ถูกต้อง ระบบจะส่งค่า HTTP 401 Unauthorized กลับมายังฝั่ง Frontend พร้อมแสดงกล่องข้อความ (Toast Notification) แจ้งให้ผู้ใช้งานทราบอย่างชัดเจนเพื่อป้องกันสแปมบอต
*(ผู้จัดทำสามารถแทรกภาพหน้าจอ: หน้าเข้าสู่ระบบ และการแสดงผลแจ้งเตือนเมื่อล็อกอินล้มเหลว)*

#### 4.1.3 การใช้งานเว็บแอปพลิเคชัน (Web Application Usage)
ส่วนติดต่อผู้ใช้งานหลักถูกออกแบบเป็นเชิงสถาปัตยกรรม (Component-based) ผ่าน React.js และ TailwindCSS เพื่อให้เป็นเว็บแอปพลิเคชันแบบตอบสนอง (Responsive Design) รองรับการแสดงผลทั้งบนคอมพิวเตอร์ แท็บเล็ต และโทรศัพท์มือถือ
*   **หน้าหลัก (Homepage):** จะแสดงรายการสินค้าโชว์เคส หรือรายการการ์ดที่กำลังเปิดประมูล ระบบดึงข้อมูลจากฐานข้อมูลผ่าน API มาปั้นเป็นคอมโพเนนต์ Card ที่แสดงรูปภาพ ชื่อการ์ด ราคาปัจจุบัน และเวลาที่เหลือในการประมูลในรูปแบบ Real-time
*   **การนำทาง (Navigation):** แถบเมนูด้านบน (Navbar) ชูด้านคุณสมบัติของ User Experience (UX) ให้เข้าถึงฟังก์ชันต่างๆ ได้รวดเร็ว เช่น ระบบตะกร้าสินค้า (Cart), ระบบแจ้งเตือน (Notifications), และเมนูควบคุมโปรไฟล์ส่วนตัว
*(ผู้จัดทำสามารถแทรกภาพหน้าจอ: ภาพรวมของหน้าแรกของแอปพลิเคชันเมื่อแสดงผลบนจอคอมพิวเตอร์ (Desktop) และจอมือถือ (Mobile))*

#### 4.1.4 การสร้างโพสสินค้า (Creating Product Posts)
ขั้นตอนนี้เป็นจุดเด่นของระบบที่ผสานเทคโนโลยีระบบปัญญาประดิษฐ์ (Computer Vision) เข้ามาร่วมด้วย เพื่อลดภาระการคัดสรรสเกลของผู้ขายและเพิ่มคุณภาพเชิงคณิตศาสตร์ของความแม่นยำ
*   **การทำงาน:** เมื่อผู้ขายต้องการสร้างโพสต์สินค้า จะมีแบบฟอร์มให้กรอกรายละเอียด เช่น ราคาเริ่มต้น คำอธิบาย และอัปโหลดภาพถ่ายของการ์ดในรูปแบบไฟล์รูปภาพปกติ
*   **ระบบสกัดขอบภาพอัตโนมัติ:** เมื่ออัปโหลดภาพ ระบบจะส่งภาพเข้ารหัสไปประมวลผลที่ส่วนกลางของ Backend ผ่านไลบรารี Emgu.CV เพื่อทำกระบวนการทดสอบอัลกอริทึม Heuristic จำนวน 6 ขั้นตอน ในการแยกขอบเขตและตัดพื้นหลังที่รบกวนออก (Cropping Extraction)
*   **ผลลัพธ์:** ผู้ขายจะได้ภาพการ์ดแบบขอบตัดตรงที่สวยงามทันทีก่อนการทำการยืนยันโพสต์ หากระบบตัดกรอบล้มเหลวเนื่องจากสภาพแสงหรือความคมชัด ไม่เพียงพอ ผู้ขายยังสามารถเลือกรูปภาพต้นฉบับได้
*(ผู้จัดทำสามารถแทรกภาพหน้าจอ: การแสดงสเต็ปฟอร์มสร้างโพสต์, ภาพเปรียบเทียบก่อน-หลังการผ่านระบบตัดขอบการ์ดรบกวน)*

#### 4.1.5 ระบบการจัดการสินค้า คำร้อง และผู้ใช้งาน (Management System)
เพื่อให้แพลตฟอร์มการประมูลมีความเสถียรภาพและได้รับความน่าเชื่อถือ จึงมีการพัฒนาระบบควบคุมศูนย์กลางสำหรับผู้ดูแล (Admin) และผู้ขาย
*   **บทบาทผู้ซื้อ/ผู้ขาย:** มีพื้นที่แดชบอร์ดจัดการโพสต์ของตนเอง ดูสถานะของสินค้าที่ถูกประมูลสำเร็จ และตรวจสอบประวัติการทำธุรกรรมหรือออเดอร์ที่ผ่านมาได้
*   **บทบาทผู้ดูแลระบบ (Admin Role):** สามารถเข้าถึงหน้ากระดานควบคุมที่มีสิทธิ์ลึกซึ้งในการดูรายการบัญชีผู้ใช้งานทั่วไป สั่งแบน (Ban) หรือระงับบัญชีที่ทำผิดกฎ รวมถึงสามารถตรวจสอบตารางข้อร้องเรียนต่างๆ (Report Table) เพื่อพิทักษ์ความถูกต้องทางข้อมูล
*(ผู้จัดทำสามารถแทรกภาพหน้าจอ: หน้าสรุปรายการสินค้าสำหรับแอดมิน, หน้าระบบติดตามและจัดการสถานะคำร้อง/บัญชี)*

#### 4.1.6 ระบบตรวจสอบภาพโดยผู้ดูแลระบบ (Admin Image Verification System)
เป็นฟังก์ชันการรักษาความปลอดภัยของพื้นที่ประมูล ออกแบบเป็นเครื่องมือเฉพาะสำหรับ **ผู้ดูแลระบบ (Admin)** ในการตรวจสอบโพสต์ที่น่าสงสัย โดยไม่ได้ทำงานอัตโนมัติในขั้นตอนสร้างโพสต์ แต่เรียกใช้งานผ่านปุ่มกดบนหน้ารายละเอียดโพสต์ (PostDetail)
*   **การทำงาน:** เมื่อผู้ดูแลระบบพบโพสต์ที่น่าสงสัย สามารถกดปุ่มเพื่อเรียกใช้ระบบตรวจสอบภาพแต่ละประเภทได้ ได้แก่ การตรวจภาพตัดต่อ (Image Manipulation Detection ด้วย 17 สัญญาณทางสถิติ) การตรวจภาพที่สร้างจาก AI (ผ่าน Sightengine CNN) และการตรวจแหล่งที่มาของภาพ (Reverse Image Search)
*   **การตรวจสอบแหล่งที่มา (Reverse Image Search):** ผู้ดูแลระบบสามารถกดปุ่มตรวจสอบแหล่งที่มาเพื่อตรวจจับภาพซ้ำซ้อน ป้องกันการขโมยรูปภาพสินค้าจากเว็บไซต์อื่นมาแอบอ้าง (เช่น การดูดรูปมาจากตลาดนอกอย่าง Mercari หรือ Yahoo Auctions JP)
*   **การแสดงผลลัพธ์:** ผลการวิเคราะห์จะแสดงให้ผู้ดูแลระบบเห็นเปอร์เซ็นต์ความเสี่ยงของภาพ หากพบว่าภาพมีความเป็น "ภาพที่สร้างจาก AI" (AI-Generated), มีร่องรอยตัดต่อ (Manipulated), หรือเป็นภาพที่คัดลอกมาจากเว็บไซต์อื่น ผู้ดูแลระบบสามารถตัดสินใจอนุมัติหรือปฏิเสธโพสต์ดังกล่าวได้
*(ผู้จัดทำสามารถแทรกภาพหน้าจอ: ปุ่มตรวจสอบภาพบนหน้า PostDetail ของ Admin และผลลัพธ์การวิเคราะห์ที่แสดงเปอร์เซ็นต์ความเสี่ยง)*

#### 4.1.7 ระบบค้นหาโพสด้วยรูปภาพ (Image-Based Search System)
ระบบค้นหาสินค้าเจาะจงผ่านประจุความคล้ายคลึงของรูปภาพนี้ ถูกจัดตั้งเพื่อแก้ปัญหาเชิงประจักษ์ในกรณีที่ผู้ซื้อไม่ทราบชื่อของการ์ด หรือไม่ทราบหมวดหมู่ของสินค้า
*   **การทำงาน:** ผู้ใช้ทำการอัปโหลดรูปภาพใบการ์ดที่ต้องการค้นหาผ่านหน้า Visual Search ระบบจะอัปสเกลแปลงข้อมูลไปยัง Python CLIP Worker สร้างเป็น Mathematical Vector ที่ระดับ 512 มิติ (512-D Vectors)
*   **การประมวลผลผลลัพธ์:** ค่าเวกเตอร์จะถูกนำไปอ้างอิงผ่านตาราง PostgreSQL และรันกระบวนท่าหาเพื่อนบ้านใกล้เคียงที่สุด (Approximate Nearest Neighbors) อ้างอิงด้วยฟังก์ชัน `match_posts_by_embedding` 
*   **การแสดงผล:** โพสต์สินค้าในฐานข้อมูลที่มีคะแนนความจัดเรียงสัมพัทธ์แนวโคไซน์ (Cosine Similarity Score) สูงกว่า 0.70 จะถูกดึงหน้าดัชนีมาแสดงผล โดยเรียงลำดับจากสินค้าที่หน้าตาตรงกับตัวอย่างมากที่สุด ลดหลั่นลงมาด้วยเวลาเชิงมิติที่รวดเร็ว
*(ผู้จัดทำสามารถแทรกภาพหน้าจอ: ขั้นตอนการอัปโหลดภาพอินพุตสำหรับค้นหา และผลลัพธ์รายการสินค้าผลลัพธ์ที่เรียงตัวกันตามระดับเปอร์เซ็นต์ความคล้ายคลึง)*

---

### 4.2 การทดสอบระบบ (System Testing)

เพื่อให้การทำงานของ WCO-Web เป็นไปอย่างราบรื่นตามมาตรฐานสากล โครงสร้างและฟังก์ชันตรรกะทั้งหมด จึงได้ผ่านกระบวนการทดสอบประสิทธิภาพที่รัดกุมใน 2 ส่วนสำคัญ ได้แก่:

#### 4.2.1 การทดสอบกล่องดำ (Black Box Testing)
การทดสอบกระบวนการนำเข้าและส่งออกข้อมูลโดยเพิกเฉยเงื่อนไขเชิงคณิตศาสตร์ เน้นพฤติกรรมการตอบสนองฝั่งผู้ใช้:
1.  **ทดสอบระบบยืนยันตัวตน (Authentication Module):** ป้อนชุดข้อมูลอีเมลหรือรหัสผ่านผิดเพี้ยน หรือแทรก JSON Web Token (JWT) หมดอายุสู่ Header ผลการทดสอบพบว่าระบบดักจับการบุกรุกและส่งสถานะอ้างอิงรหัส `401 Unauthorized` และปฏิเสธการร้องขอแก้ไขตัวโปรไฟล์สำเร็จ
2.  **ทดสอบโมเดลตรวจสอบเนื้อหาภาพหลอกลวง:** ทดสอบโดยใช้ตัวอย่างรูปภาพสกัดจากการวาดด้วย Midjourney รวมทั้งรูปภาพคละกันในอินเทอร์เน็ตจำนวน 20 รูป ผลการทดสอบสามารถระบุข้อความแจ้งหน่วงภัยคุกคามตรวจเจอเนื้อหา AI ปลอมอย่างเห็นผลประจักษ์ เกิน 85% ของมวลพารามิเตอร์การทดสอบ
3.  **ทดสอบการทำธุรกรรมร่วมของระบบประมูล:** ใช้วิธียิง Request เสนอราคาช่วงเวลาใกล้เคียงกัน พบว่าระบบฐานข้อมูลมีโครงสร้างคิว Transaction ที่สมบูรณ์ ไม่ก่อให้เกิดภาวะข้ามลำดับราคาของคิวผู้ใช้ (Race Condition)

#### 4.2.2 การทดสอบกล่องขาว (White Box Testing)
ตรวจสอบกลไกโค้ดที่ซับซ้อนเชิงโครงสร้าง เพื่อวิเคราะห์ตัวแปรและโครงสร้างฐานข้อมูลที่มีความบั่นทอน:
1.  **ทดสอบทแยงฟังก์ชัน Remote Procedure Call (RPC):** ได้ประเมินโครงร่างเกิดปัญหาที่เรียกว่า "RPC Overloading" ในระบบ Supabase ระหว่างฟังก์ชันเรียกใช้งาน Vector Search วิธีทดสอบและแก้ไขมุ่งเป้าไปยังคำสั่ง SQL ทำการ `DROP FUNCTION` เลือกใช้ค่าโครงสร้างอย่างระมัดระวัง พบปะว่าระบบแก้ปัญหา Error รหัส PGRST203 ไปได้ผลสมบูรณ์
2.  **ทดสอบตรรกะตัดขอบด้วย Emgu.CV Pipeline:** ดู Log แบบเรียลไทม์เพื่อสอดส่องการเฝ้าระวังมิติ Aspect Ratio, ตัวกรองแสง Border Gate, ตัวชี้วัดตัวอักษร TextLikelihood Score ผลลัพธ์แสดงการทำงานของอัลกอริทึมที่สามารถคัดลอกรูปทรงกรอบสี่เหลี่ยมของแผ่นกระดาษในมุมมืดออกได้อย่างมีอัตราประสิทธิผล

---

### 4.3 ผลการประเมินความพึงพอใจการใช้งาน (Usability Testing)

การวัดความพึงพอใจเกี่ยวกับการทำงานและประสบการณ์ของผู้รับบริการ ทางผู้จัดทำได้ใช้แนวปฏิบัติมาตรฐาน **System Usability Scale (SUS)** เข้ามาประเมินข้อความคิดเห็น

**ผลการวิเคราะห์ข้อมูล:**
จากการกระจายชุดแบบสอบถามจำนวน 10 ข้อสำหรับงานทดสอบ โดยสุ่มเลือกกลุ่มผู้เข้าถึงระบบที่สนใจในการ์ดเกมสะสม (Trading Card Community) จำนวน [X] คน ผลลัพธ์ประเมินตัวชี้วัดศักยภาพเครื่องมือได้ดังนี้:
*(ผู้จัดทำเว้นพื้นที่ไว้กรอกคะแนนสำรวจสถิติจริง)*
*   ภาพรวมประเมินคะแนนเฉลี่ย SUS Score สำหรับ WCO-Web อยู่ที่ **[XX.X] คะแนน** ซึ่งจัดอยู่ในความน่าเชื่อถือระดับ **[Acceptable / Good / Excellent]** (ตามเกณฑ์มาตรฐานสากลอุตสาหกรรม ซอฟต์แวร์ที่มีคะแนนความสามารถใช้งานจริงประเมินมากกว่า 68 ขึ้นไป ถือว่าประสบความสำเร็จและมีโครงร่างที่ยอมรับได้)
*   **ฟังก์ชันเรือธงที่ได้รับความพึงพอใจประจักษ์ชัดสุด:** คือ "ระบบการค้นหาและเปรียบเทียบสินค้าเจาะจงทางรูปภาพ (Visual Search)" ซึ่งผู้ทดสอบลงความเห็นและให้ทัศนคติวิพากษ์ว่าเป็นทางออกทางเทคโนโลยีที่กระชับเวลาการเรียบเรียงหมวดหมู่ ลดขั้นตอนการนึกคำค้นหาที่ตายตัวของภาษา
*   **ข้อคิดเห็นแนะนำเพื่อการพัฒนาเพิ่มเติม:** ค้นพบว่าแสงสว่างสะท้อนซ้อนทับภาพ และการดึงพื้นที่กลืนกรอบการ์ดของโมเดลอาจจะยังคลาดเคลื่อนในลักษณะวิสัยทัศน์แสงน้อย ซึ่งแนะว่าควรมีคู่มือการจัดลักษณะการถ่ายรูปให้ผู้ขายหน้ากระดาน

**บทสรุปภาพรวมในบทที่ 4:** 
จากการทดสอบและบันทึกผลการพัฒนา ระบบและเว็บไซต์ WCO-Web ตอบสนองต่อการดำเนินงานที่บัญญัติในขอบเขตไว้อย่างลงตัว กลไก AI ส่วนกลางได้พิสูจน์แล้วว่าเข้ามาช่วยลดจุดบอดในการแยกแยะความซับซ้อนได้อย่างมีนัยสำคัญ

---

## บทที่ 5: สรุปผลและข้อเสนอแนะ (Conclusion and Suggestions)

### 5.1 สรุปผลการดำเนินงาน
โครงการพัฒนาระบบเว็บแอปพลิเคชันสำหรับการประมูลและซื้อขายการ์ดเกมสะสม (WCO-Web) ได้ดำเนินการเสร็จสิ้นและบรรลุตามวัตถุประสงค์ที่ตั้งไว้ทุกประการ คณะผู้จัดทำประความสำเร็จในการบูรณาการเทคโนโลยีสถาปัตยกรรม Microservices ออกมาเป็นแพลตฟอร์มแบบ Full-Stack ที่ครอบคลุมการทำธุรกรรมครบวงจร ตั้งแต่ระบบตะกร้าสินค้า การแจ้งเตือนแบบเรียลไทม์ ตลอดจนการจัดการข้อมูลผู้ใช้งาน

จุดเด่นและแกนหลักสำคัญที่ทำให้โครงการนี้ประสบความสำเร็จ คือการนำปัญญาประดิษฐ์ (Core AI Service) เข้ามายกระดับประสบการณ์ผู้ใช้งาน (UX) อาทิ อัลกอริทึมจากไลบรารี Emgu.CV ที่สามารถแยกแยะพิกัดมุมและสกัดหน้าการ์ดออกจากพื้นหลัง (Heuristic Automated Cropping) ได้อย่างแม่นยำ รวมถึงการประยุกต์ใช้โมเดลโครงข่าย OpenAI CLIP มาร่วมกับฐานข้อมูลแบบเวกเตอร์ (pgvector) ส่งผลให้ระบบตรวจจับภาพปลอมและฟังก์ชันค้นหาสินค้าด้วยภาพถ่าย (Visual Search) ผ่านการหาค่าความคล้ายคลึงเชิงมิติ (Cosine Similarity Score) มีความยืดหยุ่นและตอบสนองได้สอดคล้องกับพฤติกรรมผู้บริโภคจริงในยุคดิจิทัล

### 5.2 ปัญหา อุปสรรค และแนวทางแก้ไข
ในระหว่างวงจรการพัฒนาซอฟต์แวร์ (Software Development Life Cycle) คณะผู้จัดทำได้พบข้อจำกัดทางเทคนิคในการประมวลผลแบบข้ามแพลตฟอร์ม และได้ดำเนินการแก้ไขให้ระบบมีความเสถียร ดังนี้:
1. **ปัญหาคอขวดในการประมวลผลคำขอ (Request Bottleneck):** ในช่วงแรกของการประเมิน ระบบเกิดปัญหาความล่าช้าขณะที่ผู้ใช้อัปโหลดรูปภาพ เนื่องจาก Backend ต้องรอผลการสกัดและวิเคราะห์โหนดสถิติเป็นเส้นตรง (Synchronous AI Processing)
 **แนวทางแก้ไข:** คณะผู้จัดทำได้เปลี่ยนสถาปัตยกรรมระบบโดยย้ายโมเดล CLIP ไปรันบนตัวขับเคลื่อนของ Python FastAPI แบบอิสระ ขนานกับเซิร์ฟเวอร์หลัก พร้อมนำหลักการ Background Task Service เข้ามาช่วยเคลียร์คิวคำสั่งแบ็คกราวน์แบบ Asynchronous ทำให้เวลาขีดจำกัดในการตอบสนอง (Response Time) ดีขึ้นอย่างก้าวกระโดด
2. **ความเชื่อมโยงระดับ Remote Procedure Call (RPC Overloading):** บริการฐานข้อมูล Supabase เกิดการปฏิเสธคำสั่งอ่านเขียน (Error Code: PGRST203) ในขณะที่แอปพลิเคชันร้องขอการค้นหา Vector Search สาเหตุมาจากการซ้อนทับกันของ Schema ฟังก์ชันที่มีเจตนาการรับพารามิเตอร์คล้ายคลึงกัน 
 **แนวทางแก้ไข:** ผู้จัดทำได้ปรับรหัสการย้ายถิ่นฐานข้อมูล (Database Migration) โดยนำวากยสัมพันธ์ `DROP FUNCTION` มาใช้นำร่อง ลบ Signature ฟังก์ชันที่เกิดความขัดแย้งควบคู่กับการระบุ Type Argument แบบเจาะจง ขจัดสภาพความกำกวมของฐานข้อมูลได้อย่างทันท่วงที
3. **ความล้มเหลวของการพิสูจน์ตัวตนข้ามโดเมน (Cross-Domain JWT Authentication):** แอปพลิเคชันฝั่งเครื่องแม่ข่าย (C# ASP.NET Core) ประสบปัญหาความไม่เข้าใจรูปแบบการเข้ารหัสลับ Authentication Token ของฝั่งเบราว์เซอร์ล้มเหลว ทำให้ตีกลับข้อผิดพลาด 401/403 (Unauthorized) เป็นประจำ
 **แนวทางแก้ไข:** คณะผู้ทำงานได้แก้ไข Middleware Pipeline โดยเพิ่มช่องทางการตั้งค่าแทรก Custom Header ภายใต้ชื่อ `X-User-Id` และจูนพารามิเตอร์ของระบบตรวจสอบลายเซ็น Token Validation Parameters จากศูนย์ ทำให้การยืนยันตัวตนข้ามโดเมนมีความสมดุลและปลอดภัยเป็นเอกเทศ

### 5.3 ข้อเสนอแนะเพื่อการพัฒนาต่อ
เพื่อให้โครงงานสามารถขยายเพิ่มขีดความสามารถและมีศักยภาพในการต่อยอดเป็นผลิตภัณฑ์ในระดับอุตสาหกรรม (Commercial Product) ต่อไปได้ คณะผู้จัดทำมีข้อเสนอแนะเพิ่มเติมดังนี้:

1. **การยกระดับการตรวจจับและสกัดภาพขอบการ์ดด้วยสถาปัตยกรรม YOLO (Transitioning to YOLO Architecture):** ในปัจจุบันระบบพึ่งพากระบวนการ Heuristic ผ่าน Emgu.CV ซึ่งมีข้อจำกัดด้านความแม่นยำเมื่อภาพถ่ายมีพื้นหลังที่มีลวดลายซับซ้อน (Complex Backgrounds) หรือมีสภาพแสงที่ไม่อำนวย ในอนาคตควรนำสถาปัตยกรรมโครงข่ายประสาทเทียมแบบตรวจจับวัตถุยุคใหม่ เช่น **YOLO (You Only Look Once)** (อาทิ YOLOv8 หรือ YOLOv11) มาประยุกต์ใช้ในการทำ Object Detection และ Instance Segmentation เพื่อหาตัวการ์ดในกรอบพิกัด (Bounding Box) และแกะกะมวลขอบ (Polygon Mask) ซึ่งจะให้ความแม่นยำที่สูงกว่า มีภูมิคุ้มกันต่อสภาพแวดล้อมรบกวนได้สมบูรณ์แบบ ทั้งยังคงความเร็วในการอนุมาน (Inference Time) ได้อย่างมีประสิทธิภาพ 
2. **การบูรณาการปัญญาประดิษฐ์เชิงลึกเพื่อประเมินสภาพสินค้า (Deep Learning for Card Grading Assessment):** ควรวิจัยและทดลองฝึกสอนแบบจำลองโหนดประสาทเทียมทางภาพลักษณะ Convolutional Neural Network (CNN) โมเดลใหม่จำเพาะ เพื่อให้สามารถจัดลำดับและให้เกรดสภาพร่องรอยขีดข่วน ถลอก หรือโค้งงอของการ์ด (Card Grading) ได้โดยอัตโนมัติ ซึ่งจะช่วยผลักมูลค่าและมาตรฐานในตลาดการ์ดสะสมมือสอง
3. **การประยุกต์ใช้โมเดล Multi-modal LLMs สำหรับระบบควบคุมเนื้อหา (Advanced AI Moderation):** นอกเหนือจากการใช้ค่าทางสถิติและการทำงานของ Sightengine API แล้ว ควรบูรณาการ Large Language Models ชนิดประมวลผลวิทัศน์ (Vision-Language Models) เข้ามาใช้อ่านและพิจารณาบริบทความเหมาะสมของรูปภาพเพื่อตรวจจับการหลอกลวงหรือภาพเขียนเจตนาทับซ้อนที่ซับซ้อนดั่งพฤติกรรมมนุษย์
4. **การพัฒนาระบบตัวแทนอัจฉริยะวิเคราะห์กลไกราคาตลาดแบบเรียลไทม์ (Market Price Tracking Bot & Predictive Analytics):** แนะนำให้เพิ่มการออกแบบเครื่องมือสำหรับกวาดข่าวมูลค่า (Web Scraping) ที่เซนเซอร์และเก็บสถิติราคากลางเชื่อมต่อกับตลาดโลก เพื่อประมวลผลแนะนำราคาขั้นต่ำในการตั้งต้นประมูล (Suggested Starting Bid) เพื่อประคองตลาดเงินเฟ้อและปกป้องฝั่งผู้เล่นหน้าใหม่
5. **การขยายระบบฐานข้อมูลเพื่อรองรับปริมาณภาพกราฟิกขนาดยักษ์ (Database Scaling and Caching Optimization):** ในอนาคตหากแพลตฟอร์มมีปริมาณสมาชิก (Traffic) เพิ่มขึ้น ควรพิจารณานำบริการดูแลหน่วยความจำชนิดคีย์-ค่าความจุสูง เช่น Redis Cache มารับน้ำหนักหน้าแรก เพื่อบรรเทาภาระการดึงโหนดข้อมูลจาก PostgreSQL โดยตรง เป็นต้น

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
