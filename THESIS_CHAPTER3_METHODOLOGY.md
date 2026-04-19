# บทที่ 3: วิธีดำเนินงาน (Methodology)

บทนี้นำเสนอขั้นตอนการดำเนินงานของโครงงาน WCO-Web ตั้งแต่กระบวนการออกแบบสถาปัตยกรรมระบบ การเลือกเครื่องมือและเทคโนโลยีที่ใช้พัฒนา ไปจนถึงการสร้างและทดสอบโมดูลสำคัญแต่ละส่วน โดยยึดกรอบแนวคิดการพัฒนาซอฟต์แวร์แบบ **Agile** ในการแบ่งงานออกเป็น Sprint เพื่อควบคุมคุณภาพและส่งมอบฟีเจอร์ได้อย่างต่อเนื่อง

---

## 3.1 กระบวนการดำเนินงานโดยรวม (Overall Development Process)

โครงงานนี้แบ่งการพัฒนาออกเป็น **4 ระยะ (Phase)** หลัก ดังนี้

```
Phase 1: วิเคราะห์และออกแบบ  →  Phase 2: พัฒนาระบบหลัก  →  Phase 3: ผสานโมดูล AI  →  Phase 4: ทดสอบและปรับปรุง
```

| ระยะ | กิจกรรมหลัก | ผลลัพธ์ที่ได้ |
|---|---|---|
| Phase 1 | รวบรวมความต้องการ, ออกแบบ ER-Diagram, เลือกสแตค | Architecture Blueprint |
| Phase 2 | พัฒนา Frontend (React), Backend (ASP.NET Core), ฐานข้อมูล (Supabase) | ระบบตลาด-ประมูลที่ใช้งานได้ |
| Phase 3 | พัฒนา Python CLIP Worker, CardDetection, Image Moderation | โมดูล AI ครบ 3 ชุด |
| Phase 4 | Black-box / White-box Testing, SUS Usability Survey | รายงานผลทดสอบ |

---

## 3.2 สภาพแวดล้อมการพัฒนาและเครื่องมือ (Development Environment & Tools)

### 3.2.1 ฮาร์ดแวร์และระบบปฏิบัติการ

โครงงานพัฒนาและทดสอบบนเครื่อง PC ติดตั้ง Windows 11 โดยใช้ Environment แบบ Local สำหรับตรวจสอบการทำงานแยกโมดูลก่อนนำขึ้น Cloud

### 3.2.2 ซอฟต์แวร์และ Framework

| บทบาท | เทคโนโลยีที่เลือกใช้ | เหตุผลในการเลือก |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite | Component-based, Hot-reload เร็ว, Ecosystem กว้าง |
| **UI Library** | TailwindCSS + DaisyUI | Utility-first, ลด CSS custom ให้น้อยลง |
| **Backend** | ASP.NET Core 8 (C#) | Performance สูง, Middleware Pipeline ยืดหยุ่น, Strongly-typed |
| **Computer Vision** | Emgu.CV 4.x (OpenCV .NET Binding) | ครอบคลุม Algorithm CV ครบ, รันบน Server ไม่ต้องการ GPU |
| **AI Worker** | Python 3.11 + FastAPI + open_clip | CLIP model รัน CPU/GPU ได้, FastAPI async สูง |
| **ฐานข้อมูล** | Supabase (PostgreSQL 15 + pgvector) | Managed DB, Auth built-in, Extension pgvector สำหรับ Vector Search |
| **File Storage** | Supabase Storage | S3-compatible, ผสานกับ DB ในแพลตฟอร์มเดียวกัน |
| **External API** | SerpAPI (Google Lens), Sightengine | Reverse Image Search และตรวจ AI-Generated Image |
| **Version Control** | Git + GitHub | ควบคุมเวอร์ชันโค้ดและ Rollback |

### 3.2.3 โครงสร้างโฟลเดอร์โปรเจค (Repository Structure)

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

## 3.3 การออกแบบสถาปัตยกรรมระบบ (System Architecture Design)

### 3.3.1 ภาพรวมสถาปัตยกรรม (High-Level Architecture)

ระบบออกแบบตามแนวคิด **3-Tier Architecture** ที่มีโมดูล AI เพิ่มเติมเป็น Microservice แยกต่างหาก ดังนี้:

```
┌──────────────┐     HTTP/REST      ┌─────────────────────────┐
│  Client-Web  │ ──────────────────▶│  server-api (ASP.NET)   │
│  (React SPA) │ ◀────────────────── │  Auth · CRUD · AI Orch  │
└──────────────┘     JSON Response  └────────┬────────┬────────┘
                                             │        │
                                    HTTP POST│        │Supabase
                                   /embed    │        │Client
                                             ▼        ▼
                                    ┌──────────┐  ┌──────────────┐
                                    │clip-worker│  │  Supabase    │
                                    │(Python)   │  │  PostgreSQL  │
                                    │ CLIP Model│  │  + pgvector  │
                                    └──────────┘  └──────────────┘
```

**หลักการสำคัญที่นำมาใช้:**
- **Separation of Concerns:** แต่ละ Service มีความรับผิดชอบเฉพาะ ไม่ซ้อนทับกัน
- **Stateless Backend:** `server-api` ไม่เก็บ Session ฝั่งเซิร์ฟเวอร์ ใช้ JWT ยืนยันตัวตนใน Header ทุก Request
- **Async Processing:** การสร้าง Embedding ของโพสต์ใหม่รันเป็น Background Task ไม่บล็อกการตอบสนองผู้ใช้

### 3.3.2 การออกแบบฐานข้อมูล (Database Schema Design)

ออกแบบ Entity Relationship โดยแบ่งตารางหลักออกเป็น 5 กลุ่ม:

| ตาราง | คอลัมน์สำคัญ | บทบาท |
|---|---|---|
| `profiles` | `id` (FK→auth.users), `display_name`, `role` | ข้อมูลผู้ใช้และสิทธิ์ |
| `posts` | `id`, `title`, `price`, `status`, `category`, `seller_id` | ข้อมูลสินค้าที่ประกาศขาย/ประมูล |
| `post_image_embeddings` | `post_id`, `embedding` (vector 512), `source_image_url`, `card_index` | เวกเตอร์ภาพสำหรับ Visual Search |
| `cart` / `cart_items` | `user_id`, `post_id`, `quantity` | ระบบตะกร้าสินค้า |
| `notifications` | `user_id`, `type`, `payload`, `read_at` | การแจ้งเตือนแบบ Real-time |

**การออกแบบ Vector Column ด้วย pgvector:**

ตาราง `post_image_embeddings` ถูกออกแบบให้รองรับ Vector Search โดยเพิ่ม Extension `pgvector` และสร้าง HNSW Index เพื่อให้การค้นหา Approximate Nearest Neighbor ทำงานในความเร็ว $O(\log n)$:

```sql
-- เปิดใช้งาน Extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ตาราง embedding
CREATE TABLE post_image_embeddings (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "postId"      uuid REFERENCES posts(id) ON DELETE CASCADE,
    embedding     vector(512),          -- 512-dimensional CLIP vector
    source_image_url text,
    card_index    int DEFAULT 0
);

-- HNSW Index สำหรับ Cosine Distance Search
CREATE INDEX idx_post_image_embeddings_embedding
    ON post_image_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```

### 3.3.3 การออกแบบ API Endpoints (REST API Design)

Backend ออกแบบ Endpoint ตามหลัก RESTful โดยแบ่งตาม Controller ดังนี้:

| Controller | Endpoint ตัวอย่าง | บทบาท |
|---|---|---|
| `PostsController` | `GET /api/posts`, `POST /api/posts` | จัดการข้อมูลโพสต์สินค้า |
| `CardDetectionController` | `POST /api/card-detection/analyze` | ครอปการ์ด + ตรวจสอบ AI |
| `CardDetectionController` | `POST /api/card-detection/search` | ค้นหาโพสต์ด้วยภาพ (Visual Search) |
| `CartController` | `POST /api/cart`, `DELETE /api/cart/{id}` | จัดการตะกร้าสินค้า |
| `NotificationsController` | `GET /api/notifications` | ดึงการแจ้งเตือน |

ทุก Endpoint ที่ต้องใช้สิทธิ์จะกำหนด Attribute `[Authorize]` และตรวจสอบ JWT ที่ออกโดย Supabase ก่อนประมวลผลทุกครั้ง

---

## 3.4 การพัฒนาระบบหลัก (Core System Development)

### 3.4.1 การพัฒนา Frontend (React Web Application)

**ขั้นตอนการพัฒนา:**

1. **สร้างโปรเจค** ด้วย Vite + React + TypeScript template และติดตั้ง Dependencies หลัก ได้แก่ `axios`, `react-router-dom`, `@supabase/supabase-js`
2. **ออกแบบ Routing** ด้วย `react-router-dom` จัดโครงสร้าง URL:
   - `/` → หน้าหลัก (รายการสินค้า)
   - `/post/:id` → รายละเอียดสินค้า (PostDetail)
   - `/search` → ค้นหาด้วยรูปภาพ
   - `/create-post` → สร้างโพสต์ใหม่
3. **สร้าง API Layer** ใน `src/api/` เพื่อรวม Logic การยิง HTTP Request ไว้ที่เดียว Frontend แต่ละหน้าใช้งานผ่าน Custom Hook
4. **ระบบยืนยันตัวตน (Authentication):** ใช้ `@supabase/supabase-js` เชื่อมกับ Supabase Auth โดยตรง (Email/Password) และนำ JWT Token ที่ได้มาแนบใน `Authorization: Bearer` Header ของทุก Request ที่ส่งไป `server-api`
5. **หน้าค้นหาด้วยภาพ:** ผู้ใช้อัปโหลดรูปผ่าน `<input type="file">` → แสดง Preview → ส่งเป็น `multipart/form-data` → รับ JSON ผลลัพธ์รายการสินค้าที่เรียงตาม Similarity Score มาแสดงผล

### 3.4.2 การพัฒนา Backend API (ASP.NET Core)

**การตั้งค่าระบบ Authentication:**

Backend ตั้งค่า `AddAuthentication` ให้รู้จัก JWT ของ Supabase โดยใช้ JWKS Endpoint เพื่อดึง Public Key มาตรวจสอบ Signature ของ Token:

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://<PROJECT>.supabase.co/auth/v1";
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            ValidateAudience = false
        };
    });
```

**การออกแบบ Service Layer:**

Business Logic ทั้งหมดแยกออกจาก Controller ด้วยหลัก **Dependency Injection** โดยลงทะเบียน Service ใน `Program.cs` และ Inject เข้า Controller ผ่าน Constructor ตามตัวอย่าง:

```csharp
// Program.cs — ลงทะเบียน Services
builder.Services.AddScoped<ICardDetectionService, CardDetectionService>();
builder.Services.AddScoped<IClipEmbeddingService, ClipEmbeddingService>();
builder.Services.AddScoped<IPostModerationAiService, PostModerationAiService>();
```

**Custom Header สำหรับการส่ง User ID:**

เนื่องจาก Supabase JWT มีโครงสร้าง Claim ที่เฉพาะ Backend จึงเพิ่ม Middleware สกัด `sub` Claim และแปะเป็น Header `X-User-Id` ให้ Controllers ใช้งานได้สะดวกโดยไม่ต้อง Parse JWT ซ้ำ:

```csharp
app.Use(async (context, next) =>
{
    if (context.User.Identity?.IsAuthenticated == true)
    {
        var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                  ?? context.User.FindFirst("sub")?.Value;
        if (userId != null)
            context.Request.Headers["X-User-Id"] = userId;
    }
    await next();
});
```

### 3.4.3 การพัฒนาระบบประมูล (Auction System)

ระบบประมูลออกแบบให้ทำงานตามกลไก **English Auction** (ราคาเพิ่มขึ้น สูงสุดชนะ) โดยมีกฎหลัก:
- โพสต์ประเภท `auction` จะมีฟิลด์ `auction_end_time`, `current_price`, `min_bid_increment`
- ผู้ใช้ที่ต้องการดันราคาส่ง `POST /api/bids` พร้อมจำนวนเงิน → Backend ตรวจว่าสูงกว่า `current_price + min_bid_increment` → อัปเดตราคา → สร้าง Notification ให้ผู้ขายและผู้เสนอราคารายก่อน
- เมื่อถึงเวลา `auction_end_time` ระบบบันทึกว่าผู้เสนอราคาสุดท้ายชนะ

---

## 3.5 การพัฒนาโมดูล AI ประมวลผลภาพ (AI Image Processing Modules)

ส่วนนี้เป็นหัวใจหลักของโครงงาน แบ่งออกเป็น **3 โมดูล** ที่ทำงานต่อกันเป็น Pipeline:

```
รูปภาพที่ผู้ใช้อัปโหลด
        │
        ▼
[โมดูล 1] CardDetectionService  →  ครอปการ์ดออกจากพื้นหลัง
        │
        ▼
[โมดูล 2] ImageManipulationDetection + Sightengine  →  ตรวจสอบภาพปลอม/ภาพ AI
        │
        ▼
[โมดูล 3] CLIP Embedding + pgvector  →  สร้าง/ค้นหาเวกเตอร์ภาพ
```

### 3.5.1 โมดูลที่ 1: การตรวจจับและครอปภาพการ์ดอัตโนมัติ (CardDetectionService.cs)

โมดูลนี้ใช้ไลบรารี **Emgu.CV** (OpenCV สำหรับ C#) ดำเนินการวิเคราะห์และสกัดพื้นที่ของการ์ดออกจากภาพถ่ายด้วย **Heuristic 6 ขั้นตอน** ดังนี้:

**ขั้นตอนที่ 0 — Color-based Background Segmentation:**
ระบบสุ่มตัวอย่างพิกเซลจากขอบทั้ง 4 ด้านของภาพเพื่อประมาณสีพื้นหลังในปริภูมิ HSV จากนั้นสร้าง Binary Mask โดยพิกเซลที่ระยะสีถ่วงน้ำหนักเกิน 35 หน่วยจากค่าเฉลี่ยขอบถือเป็น Foreground นำไปใช้เป็นข้อมูลเสริมในขั้นต่อไป

**ขั้นตอนที่ 1 — Projection-based Grid Detection:**
เหมาะสำหรับภาพที่มีการ์ดวางเรียงเป็นตาราง ระบบคำนวณ Sobel Gradient แนวนอนและแนวตั้ง แล้วฉายค่ากลาง (Projection Profile) เพื่อหาช่วงที่ Gradient ต่ำ ซึ่งเป็นช่องว่างระหว่างการ์ด จากนั้นแบ่งพิกัดเป็น Grid Cell และตรวจ Aspect Ratio ว่าตรงกับอัตราส่วนมาตรฐาน Trading Card ($\approx 0.714$)

**ขั้นตอนที่ 2 — Multi-Scale Contour Detection:**
รันการหาเส้นขอบที่ **3 สเกล** (100%, 75%, 50%) เพื่อจับการ์ดขนาดต่างกัน ในแต่ละสเกลดำเนินการ: Histogram Equalization → Gaussian Blur → Adaptive Threshold → Otsu's Threshold → Adaptive Canny → Morphological Close/Dilate → FindContours กรองเฉพาะสี่เหลี่ยมที่ Aspect Ratio อยู่ในช่วง 0.50–0.92

**ขั้นตอนที่ 3 — Grid Completion:**
ถ้าการ์ดที่พบวางเรียงแต่บางช่องหายไป ระบบคำนวณขนาดและตำแหน่งของช่องที่ขาดใหม่โดยอนุมานจากช่องที่พบแล้ว ช่วยให้ไม่พลาดการ์ดที่ถูกบังบางส่วน

**ขั้นตอนที่ 4 — การให้คะแนน (Scoring):**
ผู้สมัครทุกรายได้คะแนนรวมจาก 3 มิติ:
- **Texture Score:** วัด StdDev ของ Grayscale และ Sobel Gradient (การ์ดมีลวดลาย Artwork → Texture สูง)
- **MSER Text-Likelihood Score:** ตรวจจับ Region ที่คล้ายตัวอักษรด้วย MSER Algorithm การ์ดแทบทุกใบมีตัวหนังสือชื่อการ์ด ค่า HP ฯลฯ
- **Border Contrast Score:** วัดความแตกต่างสีระหว่างขอบในกับพิกเซลนอกกรอบ

สูตรคะแนนรวม:
$$\text{score} = \text{TextureScore} \times (0.40 + 0.35 \times \text{AspectFit} + 0.25 \times \text{TextLikelihood}) \times \text{TextGate} \times \text{BorderGate}$$

**ขั้นตอนที่ 5 — Deduplication และ Final Crop:**
ตัดกรอบที่ Overlap กันเกิน 25% ออก กรองกรอบที่เล็กกว่า 28% ของ Median Area สุดท้ายเพิ่ม Padding 1.2% รอบขอบก่อน Crop และ Encode เป็น Base64 JPEG ส่งต่อ

### 3.5.2 โมดูลที่ 2: การตรวจสอบภาพตัดต่อและภาพ AI (Image Moderation)

โมดูลนี้ทำงาน 2 ชั้นคู่ขนาน:

**ชั้นที่ 1 — Local Heuristic Analysis (`ImageManipulationDetectionService.cs`):**

วิเคราะห์ **17 สัญญาณสถิติ** แบ่งเป็นสัญญาณตรวจภาพตัดต่อ (Splicing) 11 ชนิด และสัญญาณตรวจภาพ AI 6 ชนิด โดยไม่ต้องใช้ GPU:

*กลุ่มสัญญาณตรวจภาพตัดต่อ (Manipulation Signals):*
- **Multi-level ELA (Error Level Analysis):** บีบอัด JPEG ซ้ำที่ 4 ระดับ Quality (60, 70, 80, 92) แล้วหาผลต่างกับต้นฉบับ บริเวณที่ถูกแปะมาจากภาพอื่นจะมี Error Level แตกต่างจากรอบข้าง
- **Color Channel Correlation:** คำนวณ Pearson Correlation ระหว่างช่องสี R-G-B ทีละ Tile 32×32 พิกเซล (Coefficient of Variation สูง = ความสัมพันธ์ไม่สม่ำเสมอ = likely splice)
- **JPEG Ghost:** ทดสอบ 12 ระดับ Quality เพื่อหา "Native Quality" ของแต่ละ Tile ภาพที่ splice มาจากหลายแหล่งจะมี Native Quality กระจายไม่สม่ำเสมอ
- **Wavelet Noise Inconsistency:** วิเคราะห์ Sub-band HH (High-High) ของ Haar Wavelet Transform วัด Coefficient of Variation
- *และสัญญาณอื่นๆ อีก 7 ชนิด*

*กลุ่มสัญญาณตรวจภาพ AI (AI-Generation Signals):*
- **Multi-scale Noise Floor:** วัด Residual Noise ที่ 3 Kernel Size (3×3, 5×5, 9×9) ภาพ AI จาก Stable Diffusion / Midjourney จะ "เรียบ" ผิดธรรมชาติ (ค่าต่ำ)
- **High-Frequency Ratio:** เปรียบอัตราส่วน High-Frequency Energy ต่อ Mid-Frequency Energy ภาพถ่ายจริงมี Sensor Noise ที่ความถี่สูง ภาพ AI ไม่มี
- **Color Palette Uniformity:** ภาพ AI มีการกระจายสีเป็นระเบียบกว่าภาพถ่ายธรรมชาติ
- *และสัญญาณอีก 3 ชนิด*

ค่าดิบของแต่ละสัญญาณแปลงเป็นเปอร์เซ็นต์ความเสี่ยง 0–85% ด้วย **Sigmoid Normalization** จากนั้นรวมด้วย **Weighted Average** และคูณด้วย **Concordance Factor** (IQR-based) เพื่อปรับค่าขึ้น-ลงตามระดับการเห็นตรงกันของสัญญาณ

**ชั้นที่ 2 — External Deep Learning (Sightengine API):**

ส่งรูปภาพไปยัง Sightengine และรับค่า `ai_generated` probability กลับมา ซึ่งใช้โมเดล CNN (ResNet-based) เป็นตัวยืนยันซ้ำเพื่อลด False Negative ที่อาจเกิดจาก Heuristic ชั้นแรก

**การตัดสินใจ (Decision Logic):**

```
if   aiGenRisk >= 52  AND aiGenRisk > manipRisk + 6  →  "ai-generated"  
elif manipRisk >= 52  AND manipRisk > aiGenRisk + 6  →  "manipulation"
elif aiGenRisk >= 38  OR  manipRisk >= 38            →  "mixed-signals"
else                                                 →  "heuristic"

Warning Level:
  manipulation >= 75 → "danger" | >= 52 → "warning" | else → "safe"
  ai-generated >= 58 → "danger" | >= 35 → "warning" | else → "safe"
```

### 3.5.3 โมดูลที่ 3: ระบบค้นหาด้วยรูปภาพ (Visual Search via CLIP + pgvector)

โมดูลนี้แบ่งการทำงานออกเป็น 2 ส่วน:

**ส่วน A — Python CLIP Worker (`clip-worker/main.py`):**

สร้าง FastAPI Service ที่โหลดโมเดล **OpenAI CLIP ViT-B/32** ผ่านไลบรารี `open_clip` และ expose Endpoint `POST /embed` รับ List ของ Base64 Image และคืน List ของ float[] ขนาด 512:

```python
model, _, preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='openai')

@app.post("/embed")
async def embed(payload: EmbedRequest):
    images_tensor = torch.stack([preprocess(img) for img in pil_images])
    with torch.no_grad():
        emb = model.encode_image(images_tensor)
        emb = emb / emb.norm(dim=-1, keepdim=True)  # L2 Normalize
    return {"embeddings": emb.tolist()}
```

การ L2 Normalize ก่อนบันทึกทำให้ทุก Vector มีความยาว = 1.0 ทำให้การคำนวณ Cosine Similarity ลดรูปเป็น Dot Product:
$$\text{Cosine Similarity}(A, B) = A \cdot B \quad \text{(เมื่อ } \|A\| = \|B\| = 1\text{)}$$

**ส่วน B — Indexing และ Search ใน ASP.NET Core:**

เมื่อผู้ขายสร้างโพสต์ใหม่ `PostEmbeddingIndexingService` รัน Background Task:
1. ดาวน์โหลดรูปจาก Supabase Storage
2. เรียก `CardDetectionService` ครอปการ์ดทุกใบในรูป
3. ส่งไปยัง CLIP Worker → ได้ float[512] ต่อการ์ดหนึ่งใบ
4. Insert ลงตาราง `post_image_embeddings` ใน Supabase

เมื่อผู้ใช้ค้นหาด้วยรูปภาพ `CardDetectionController.SearchSimilar`:
1. ครอปการ์ดจากรูปที่ผู้ใช้อัปโหลด (สูงสุด 12 ใบ)
2. ส่งไป CLIP Worker → ได้ Query Embeddings
3. ยิง RPC `match_posts_by_embedding` ไปยัง Supabase พร้อม Threshold 0.70
4. Merge ผลลัพธ์โดยเก็บ Score สูงสุดต่อโพสต์ เรียงลำดับและส่งกลับ Frontend

**ฟังก์ชัน SQL สำหรับ Vector Search:**

ฟังก์ชัน `match_posts_by_embedding` ใน PostgreSQL ใช้ Operator `<=>` ของ pgvector ซึ่งคำนวณ **Cosine Distance** และ HNSW Index ช่วยให้ค้นหาเร็ว:

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

### 3.5.4 โมดูลเสริม: Reverse Image Search ด้วย Google Lens

เมื่อผู้ขายอัปโหลดรูป `ExternalReverseImageService.cs` ส่ง URL รูปไปยัง **SerpAPI (Google Lens, mode = exact_matches)** เพื่อตรวจสอบว่ารูปนั้นปรากฏในเว็บประมูลการ์ดที่กำหนดไว้ เช่น Mercari, Yahoo Auctions JP, Magi หรือไม่ จากนั้นยืนยันด้วย **dHash (Perceptual Hash)** และ **CLIP Cosine Similarity** เพื่อแยกแยะว่าเป็น "รูปเดิมขโมยมา" หรือ "การ์ดชนิดเดียวกันจากเจ้าของต่างคน" โดยมีหลักเกณฑ์:

- พบบน Marketplace เป้าหมาย ≥ 1 ลิงก์: **Risk 73–85%**
- พบบนเว็บทั่วไป ≥ 3 ลิงก์: **Risk 60–75%**
- dHash Hamming Distance ≤ 12/64 bit: ยืนยัน **Exact Match**

---

## 3.6 การผสานโมดูลและการบูรณาการระบบ (System Integration)

### 3.6.1 ขั้นตอนการรัน Pipeline เมื่อสร้างโพสต์ใหม่

```
1. ผู้ขายกรอกฟอร์มและแนบรูปใน Frontend
2. Frontend ส่ง multipart/form-data → POST /api/card-detection/analyze
3. Backend รัน CardDetectionService  →  ได้ Cropped Image(s)
4. Backend รัน ImageManipulationDetectionService (17 signals)
5. Backend เรียก Sightengine API (ยืนยัน AI-Generated)
6. Backend เรียก ExternalReverseImageService (Google Lens)
7. Backend ประมวลผลผลลัพธ์รวม → ส่งกลับ JSON:
   { manipulationWarning, aiGeneratedWarning, reverseImageWarning }
8. ถ้า Frontend ยืนยันโพสต์ → POST /api/posts สร้างโพสต์ในฐานข้อมูล
9. BackgroundService รัน CLIP Embedding แบบ Async → Insert ลง post_image_embeddings
```

### 3.6.2 ขั้นตอนการรัน Pipeline เมื่อค้นหาด้วยรูปภาพ

```
1. ผู้ใช้อัปโหลดรูปภาพการ์ดใน Search Page
2. Frontend ส่ง multipart/form-data → POST /api/card-detection/search
3. Backend รัน CardDetectionService ครอปการ์ดจากรูป (max 12 ใบ)
4. Backend รัน ClipEmbeddingService ส่ง Batch ไป Python Worker
5. Python Worker รัน CLIP ViT-B/32 → คืน float[512] ต่อการ์ด
6. Backend ยิง RPC match_posts_by_embedding (threshold=0.70, limit=30)
7. Supabase HNSW Index ค้นหา Nearest Neighbor → คืน (postId, score)
8. Backend Fetch ข้อมูลโพสต์ เรียง score → ส่งกลับ Frontend
9. Frontend แสดงรายการโพสต์เรียงตามความคล้ายคลึง
```

---

## 3.7 การตั้งค่าและ Configuration สำคัญ (Configuration Management)

ค่าพารามิเตอร์สำคัญที่ใช้ในระบบจัดเก็บใน `appsettings.json` เพื่อให้ปรับเปลี่ยนได้โดยไม่ต้องแก้ไขโค้ด:

```json
{
  "Supabase": {
    "Url": "https://<PROJECT>.supabase.co",
    "AnonKey": "...",
    "ServiceRoleKey": "..."
  },
  "ClipWorker": {
    "BaseUrl": "http://localhost:5000"
  },
  "Sightengine": {
    "ApiUser": "...",
    "ApiSecret": "..."
  },
  "SerpApi": {
    "ApiKey": "..."
  }
}
```

ค่าพารามิเตอร์คงที่ของอัลกอริทึม Computer Vision ที่สำคัญ:

| พารามิเตอร์ | ค่า | ความหมาย |
|---|---|---|
| `CardAspect` | 0.714 (2.5/3.5) | อัตราส่วนมาตรฐาน Trading Card |
| `MinAspectRatio` / `MaxAspectRatio` | 0.50 – 0.92 | ช่วงยอมรับความคลาดเคลื่อนจากมุมถ่าย |
| `match_threshold` | 0.70 | Cosine Similarity ขั้นต่ำสำหรับ Visual Search |
| `MaxCardsReturned` | 24 | การ์ดสูงสุดต่อรูป |
| `CropPaddingFraction` | 1.2% | Padding ขอบการ์ดก่อน Crop |

---

## 3.8 เครื่องมือและขั้นตอนการทดสอบ (Testing Approach)

### 3.8.1 Unit Testing และ Integration Testing

ทดสอบฟังก์ชันแต่ละหน่วยของ Backend ด้วยการเรียกตรงผ่าน Postman และ Unit Test บน xUnit ตรวจสอบ:
- ผลลัพธ์ของ `CardDetectionService.DetectAndCropAsync` กับชุดรูปทดสอบ 20 รูป
- ค่าที่คืนจาก `ImageManipulationDetectionService.AnalyzeAsync` กับรูปปกติ, รูปที่ตัดต่อ, และรูป AI
- การเชื่อมต่อ CLIP Worker ผ่าน `ClipEmbeddingService.GetEmbeddingsAsync`

### 3.8.2 Black-box Testing

ทดสอบระบบจากมุมมองผู้ใช้งาน โดยไม่สนใจโค้ดภายใน:
- ทดสอบการล็อกอินด้วยข้อมูลถูกต้อง/ผิด → ตรวจสอบ 401 Unauthorized
- ทดสอบอัปโหลดรูปที่สร้างด้วย Midjourney → ตรวจสอบว่าระบบปฏิเสธ
- ทดสอบการค้นหาด้วยรูปการ์ด → ตรวจสอบผลลัพธ์ที่เรียงตาม Score

### 3.8.3 Usability Testing (SUS)

แจกแบบสอบถาม **System Usability Scale (SUS)** ให้กลุ่มผู้ทดสอบ โดยมีเงื่อนไขบรรลุผล คือ SUS Score เฉลี่ย > 70 คะแนน (ระดับ Acceptable) สำหรับฟีเจอร์หลัก ได้แก่ การอัปโหลดและครอปรูป, การค้นหาด้วยภาพ, และการประมูลสินค้า
