# 📘 คู่มือสถาปัตยกรรมและทฤษฎีระบบเบื้องหลัง (System Architecture & AI Theory)
เอกสารชุดนี้จัดทำขึ้นเพื่อใช้อธิบายโครงสร้างของแอปพลิเคชัน WCO-Web การแบ่งหน้าที่ของโฟลเดอร์โค้ด ขั้นตอนการวิเคราะห์ข้อมูล ตลอดจนทฤษฎีคณิตศาสตร์เบื้องหลังการทำงานรันโมเดล AI เพื่อให้คนที่เข้ามาศึกษาต่อสามารถทำความเข้าใจภาพรวมของระบบได้ทันที

---

## 1. 🏗️ สถาปัตยกรรมและโครงสร้างโค้ดส่วนต่างๆ (System Architecture & Code Roles)
แอปพลิเคชันของเราพัฒนาด้วยรูปแบบ **Microservices Architecture** ขนาดย่อม โดยแบ่งหน้าที่ของโค้ดออกเป็น 3 ส่วนหลักที่ทำงานแยกกัน แต่ติดต่อสื่อสารกันผ่าน HTTP API และฐานข้อมูล 

### 1) 🌐 `client-web/` (Frontend - ส่วนหน้าบ้าน)
* **หน้าที่หลัก:** เป็นด่านหน้าคอยรับคำสั่งและรูปภาพจากผู้ใช้งานผ่าน Browser, สร้างปุ่ม, แสดงฟอร์มโต้ตอบ และโชว์ผลลัพธ์การค้นหาสินค้าประมูล
* **ไฟล์โค้ดสำคัญ:** โค้ดในโฟลเดอร์ `src/pages/` และ `src/api/` ทำหน้าที่แปลงข้อมูล Form (รูปภาพการ์ด) และยิง HTTP Request ผ่านไลบรารี Axios ส่งไปยัง Backend
* **ผลลัพธ์ (Output):** หน้า UI ตอบสนองผู้ใช้ (Interactive User Interface) ที่ดึงผลลัพธ์หน้าตาสินค้าการ์ดมาแสดงผลบนจอ

### 2) ⚙️ `server-api/` (Backend Middleware - ส่วนจัดการตรรกะ)
* **หน้าที่หลัก:** เปรียบเสมือนศูนย์กลางจราจร (Hub) ของเว็บไซต์ เขียนด้วยภาษา C# (ASP.NET Core) ชี้เป้าและคัดแยกรูปภาพ ทำงานตั้งแต่รับภาพ, ตรวจสิทธิ์ผู้ใช้งาน (Auth JWT), และคิวรี่ข้อมูลส่งกลับไปกลับมาเซิร์ฟเวอร์
* **ไฟล์โค้ดสำคัญ:**
  * `Controllers/PostsController.cs` (และ Controllers อื่นๆ): ด่านหน้ารับ URL Request จากผู้ใช้งาน
  * `Controllers/CardDetectionController.cs`: Endpoint สำหรับ detect/crop การ์ดและ search ด้วยรูปภาพ (CLIP + pgvector)
  * `Controllers/AdminController.cs`: Endpoint สำหรับ Admin อนุมัติ/ปฏิเสธโพสต์ พร้อมระบบ AI screening หลากหลายโหมด
  * `Services/CardDetectionService.cs` (~1,119 บรรทัด): โค้ดสำคัญที่มีฟังก์ชันใช้ไลบรารี **Emgu.CV** ดำเนินการสแกนรูปภาพและใช้คณิตศาสตร์ตัดขอบรูปการ์ดเกมออกมาแบบอัตโนมัติ (6-step heuristic)
  * `Services/ClipEmbeddingService.cs`: HTTP Client เชื่อม Python CLIP Worker เพื่อรับเวกเตอร์ 512 มิติ
  * `Services/PostEmbeddingIndexingService.cs`: Background Task สำหรับ index เวกเตอร์เข้าฐานข้อมูลเมื่อสร้างโพสต์ใหม่
  * `Services/PostModerationAiService.cs`: Orchestrator หลักของระบบ AI Moderation ที่รวม source check (SerpAPI + dHash + CLIP), manipulation check, และ AI-generated check (ใช้การให้คะแนนแบบ Max() แทน Average() เพื่อดักจับภาพปลอมได้เด็ดขาดขึ้น)
  * `Services/ImageManipulationDetectionService.cs`: ระบบตรวจจับภาพตัดต่อและ AI ด้วย 17 สัญญาณ heuristic (มีการทำ v2 calibration ปรับช่วง threshold ให้รองรับธรรมชาติของการ์ด และมี Composite Signature Override)
  * `Services/AiImageAnalysisService.cs`: ตรวจความสมจริงของการ์ดด้วย Tesseract OCR (ขั้นต่ำ 8 ตัวอักษร), Sharpness, และ Card Layout (ใช้ Morphological Close เชื่อมขอบการ์ดที่ขาด และรองรับ 15-card grid ด้วยเกณฑ์ >8% area)
  * `Services/ExternalReverseImageService.cs`: ค้นหาภาพจาก Google Lens ผ่าน SerpAPI (exact_matches mode)
  * `Services/SightengineAiDetectionService.cs`: เรียก Sightengine ML API ตรวจจับภาพ AI-generated
  * `Services/RelatedPostsService.cs`: ค้นหาโพสต์ที่เกี่ยวข้องด้วย CLIP embedding (ใช้เกณฑ์ต่างจากการค้นหาด้วยรูป)
  * `Services/SupabaseService.cs`: โค้ดใช้เชื่อมต่อกับฐานข้อมูล Supabase แทรกลงตารางหรือเรียกบันทึกข้อมูลสินค้าไปเก็บบน Cloud DB หรือ Storage
* **ผลลัพธ์ (Output):** ตอบกลับ JSON Response ข้อมูลประมวลผลให้ Frontend ตลอดจนการลบ เซฟ อัปเดตข้อมูลบน Database

### 3) 🤖 `clip-worker/` (AI Image Processor - ส่วนโปรเซสเซอร์วิเคราะห์ภาพ)
* **หน้าที่หลัก:** Service ย่อยเพื่อรัน AI ที่เน้นการกินหน่วยประมวลผลสูง (AI Compute) ถูกปรับให้แยกเขียนด้วยเฟรมเวิร์ก Python สโคปงานมีอย่างเดียวคือรับ "ข้อมูลภาพพิกเซล" และคายออกมาเป็น "เวกเตอร์คณิตศาสตร์"
* **ไฟล์โค้ดสำคัญ:** `main.py` — ดาวน์โหลดพารามิเตอร์รันโมเดล **OpenAI CLIP (ViT-B-32)** ผ่านไลบรารี `open_clip` พร้อม L2 Normalize ให้ใช้กับ Cosine Distance ได้ทันที
* **ผลลัพธ์ (Output):** ชุดพิกัดตัวเลขทศนิยมเรขาคณิตจํานวน 512 ตัว (512-dimensional vector array) ต่อ 1 รูปภาพ

---

## 2. 🔄 Flow ขั้นตอนการทำงานและผลลัพธ์ (Workflow & Expected Outputs)

ระบบ AI ของ WCO-Web แบ่งออกเป็น **2 กระบวนการหลัก** ที่ทำงานแยกกันโดยสิ้นเชิง:

### Process A: 🚀 Automatic Post-Creation Pipeline (อัตโนมัติเมื่อสร้างโพสต์)
เมื่อผู้ขายสร้างโพสต์สินค้าใหม่ ระบบจะรัน AI indexing ใน **background task** (fire-and-forget ไม่ block response) อัตโนมัติ:

1. **ส่งภาพเข้าระบบ:** Frontend (`client-web`) ส่งภาพสถานที่จริงเต็มใบ (Raw Image) มาหา `server-api` ผ่าน Endpoint `POST /api/posts`
2. **ครอปสกัดรูปเฉพาะจุด (Computer Vision):** `PostEmbeddingIndexingService` ดาวน์โหลดรูปจาก Supabase Storage แล้วโยนเข้า `CardDetectionService.cs` เพื่อหาขอบการ์ดและตัดพื้นหลังออก
   - **(Output):** ภาพการ์ดโฟกัสเน้นๆ ปราศจากพื้นโต๊ะ (Cropped Image Blob) แต่ละใบแยกกัน
3. **สร้างเวกเตอร์พิกัดภาพ (clip-worker):** ส่งรูปที่ crop แล้วไปยัง Python Worker ให้รัน CLIP ViT-B/32 อ่านองค์ประกอบของศิลปะลายเส้น
   - **(Output):** อาร์เรย์ชุดพิกัด 512 ตำแหน่ง ยกตัวอย่างหน้าตาข้อมูลเช่น `[0.081, -0.421, 0.992, ...]`
   - **หมายเหตุ:** เวกเตอร์ทุกตัวจะถูก L2 Normalize ก่อนส่งกลับ (ความยาวเท่ากับ 1.0) ทำให้สามารถคำนวณ Cosine Similarity ด้วย Dot Product ตรงๆ ได้เลย
4. **Index เข้าฐานข้อมูล:** `PostEmbeddingIndexingService` บันทึกเวกเตอร์ลงตาราง `post_image_embeddings` ใน Supabase (1 โพสต์ = หลาย embedding ถ้าพบหลายการ์ด)
   - **(Output):** ข้อมูลพร้อมให้ค้นหาด้วย pgvector HNSW index

### Process B: 🛡️ Admin-Triggered AI Moderation (Admin กดตรวจสอบ)
เมื่อ Admin กดปุ่มตรวจสอบภาพโพสต์บน Dashboard ระบบจะรัน **3 ระบบย่อย** พร้อมกัน ผ่าน `PostModerationAiService.cs`:

1. **Source Analysis (Reverse Image Search):**
   - ส่ง URL ภาพไป `ExternalReverseImageService` → ค้นหาด้วย SerpAPI Google Lens (`exact_matches` mode)
   - ยืนยันผลด้วย **dHash** (Perceptual Hash) เพื่อพิสูจน์ว่าเป็นภาพเดิมจริงๆ ไม่ใช่แค่การ์ดชนิดเดียวกัน
   - เปรียบเทียบด้วย **CLIP Embedding** (composition similarity) เพิ่มเติมเพือดูความคล้ายทั้งภาพ
   - **(Output):** `ExternalSourceRiskPct` (0-100%) + `SourceWarningLevel` (danger/warning/safe)

2. **Manipulation Detection (ตรวจจับภาพตัดต่อ):**
   - `ImageManipulationDetectionService` วิเคราะห์ **11 สัญญาณ** ด้วย Sigmoid Normalization + Concordance Analysis
   - **(Output):** `ManipulationRiskPct` (0-100%) + `ManipulationWarningLevel` (danger ≥75% / warning ≥52% / safe)

3. **AI-Generated Detection (ตรวจจับภาพ AI):**
   - ระบบจะรันผ่านโหมดการให้คะแนนจาก `SightengineAiDetectionService` เป็นคะแนนตั้งต้น (Base Score)
   - จากนั้นใช้ `AiImageAnalysisService` ตรวจสอบความสมจริง (Heuristic Penalties):
     - **OCR Penalty:** ถ้า Tesseract สกัดตัวอักษรได้น้อยกว่า 8 ตัว (ตีเป็น AI gibberish) จะบวกคะแนนความเสี่ยงเพิ่ม
     - **Layout & Edge Penalty:** ใช้ Morphological Close ปิดรอยแตกของขอบภาพ (ซึ่งพบบ่อยใน AI) และใช้เกณฑ์พื้นที่ขอบการ์ดขั้นต่ำ 8% เพื่ออนุโลมภาพถ่ายตาราง 15 ใบ (15-card grids) ให้ผ่านได้
   - **(การคำนวณผล):** ระบบจะใช้ค่า **Max()** ของความเสี่ยง AI-generated จากรูปทุกรูปในโพสต์ (แทนการใช้ค่าเฉลี่ย Average) เพื่อให้มั่นใจว่าถ้ามีรูปปลอมแค่รูปเดียว โพสต์นั้นจะถูกตั้งข้อสงสัยทันที
   - **(Output):** `AiGeneratedRiskPct` (0-100%) + `AiGeneratedWarningLevel` (danger ≥60% / warning ≥35% / safe)

### Process C: 🔍 Image Search (ผู้ใช้ค้นหาด้วยรูปภาพ)
เมื่อผู้ใช้งานอัปโหลดรูปภาพเพื่อ **"ค้นหาสินค้าด้วยภาพ"** ระบบจะมีการรับส่งข้อมูลแบบสายพาน (Pipeline Data Flow) ดังนี้:

1. **ส่งภาพเข้าระบบ:** Frontend ส่งภาพผ่าน `POST /api/card-detection/search` (รับ max 30 MB)
2. **ครอปสกัดรูปเฉพาะจุด:** `CardDetectionService` ตัดการ์ดออกมา (สูงสุด 12 ใบ)
3. **สร้างเวกเตอร์:** `ClipEmbeddingService` ส่ง HTTP POST ไป Python Worker → ได้ `float[512]` ต่อการ์ด
4. **หาคู่เหมือนฝาแฝด:** RPC `match_posts_by_embedding` ใน pgvector ด้วย cosine similarity ≥ **0.92** (configurable ผ่าน `ImageSearch:MinSimilarityScore`)
   - **(Output):** รายการโพสต์ที่คล้ายกันเรียงตาม similarity score สูงสุด (สูงสุด 12 โพสต์)

---

## 3. 🧠 ทฤษฎีเบื้องหลังโมเดลการคำนวณ (Theoretical Foundations)

### 3.1 OpenAI CLIP (Contrastive Language-Image Pretraining)
CLIP เป็นโมเดล Deep Learning ที่ถูกเทรนให้ "จับคู่" สิ่งที่มีความหมายใกล้เคียงกัน ระหว่างรูปภาพและข้อความ ให้พิกัดตัวเลขไปตกอยู่ในพื้นที่เดียวกันได้ (Joint Embedding Space)

**กระบวนการทำงานภายใน (ViT-B/32):**
- โค้ดของระบบเราอ้างอิงถึงโมเดลลูกย่อยของ CLIP ซึ่งก็คือชั้น **Vision Transformer (ViT)**
- ข้อมูลภาพจะถูกหั่นซอยแบ่งออกเป็นตารางสี่เหลี่ยมเล็กๆ (Patches) ขนาด 32x32 พิกเซล 
- แต่ละ Patch จะประมวลผลผ่าน Matrix Multiplication ของชั้นคณิตศาสตร์ปัญญาประดิษฐ์ (Self-Attention) เพื่อแยกว่าพิกเซลตรงไหนมีความสัมพันธ์กัน
- สุดท้ายโมเดลจะบีบอัดความหมายของตารางทั้งหมดให้เหลือพิกัดเพียงจุดเดียวในแกนนามธรรม **512 มิติ** ($v \in \mathbb{R}^{512}$)

**L2 Normalization ก่อนบันทึก:**
ในไฟล์ `clip-worker/main.py` หลังจากโมเดลให้เวกเตอร์ออกมาแล้ว มีโค้ดบรรทัดสำคัญ:
```python
emb = emb / emb.norm(dim=-1, keepdim=True)  # L2 normalize for cosine
```
โค้ดบรรทัดนี้ทำให้เวกเตอร์ทุกตัวมี**ความยาว = 1.0** เสมอ ผลลัพธ์คือเมื่อนำเวกเตอร์ 2 ตัวที่ normalize แล้วมา **Dot Product** กัน ค่าที่ได้ = **Cosine Similarity** ตรงๆ ไม่ต้องหารด้วย norm อีกรอบ ทำให้ฐานข้อมูลคำนวณได้เร็วขึ้นมาก

**สมการความคล้ายคลึงโคไซน์ (Cosine Similarity):**
คณิตศาสตร์ที่ `pgvector` ทำงานในการตัดสินว่าภาพมีส่วนซ้ำคลึงกัน คือการวัด "มุม (Angle)" ระหว่างจุดเวกเตอร์ 2 เส้น
$$ \text{Cosine Similarity} (A, B) = \cos(\theta) = \frac{A \cdot B}{\|A\| \|B\|} = \frac{\sum_{i=1}^{n} A_i B_i}{\sqrt{\sum_{i=1}^{n} A_i^2} \sqrt{\sum_{i=1}^{n} B_i^2}} $$
*   $A$ = ชุดเวกเตอร์ข้อมูลภาพฝั่งผู้ใช้อัปโหลด (512 ตัวเลข)
*   $B$ = ชุดเวกเตอร์โพสต์สินค้าที่เก็บบันทึกอยู่เดิมในฐานข้อมูล (512 ตัวเลข)
*   ผลลัพธ์สมการจะตกอยู่ในช่วง **-1 ถึง 1** โดยที่หากมุมทั้งสองทับเส้นเบอร์เดียวกัน (มุมห่าง 0 องศา) ผลรวมของสมการคือ **1** แปลว่ารูปการ์ดเหมือนกันระดับเป๊ะ 100%
*   เมื่อเวกเตอร์ผ่าน L2 Normalize แล้ว: $\|A\| = \|B\| = 1$ ดังนั้นสูตรลดรูปเหลือ $\text{Similarity} = A \cdot B$ เลย (Dot Product เดี่ยวๆ)


---

#### 🔑 โค้ดหลักของฟีเจอร์ค้นหาโพสต์ด้วยรูปภาพ (Image Search Pipeline)

ฟีเจอร์นี้ให้ผู้ใช้ **อัปโหลดรูปภาพการ์ด → ระบบหาโพสต์สินค้าที่มีการ์ดหน้าตาคล้ายกัน** โดยทำงานเป็นสายพาน 4 ขั้นตอน:

```
รูปผู้ใช้ → CardDetection (crop) → CLIP Embed → pgvector RPC → รายการโพสต์คล้ายกัน
```

---

**[1] `ClipEmbeddingService.cs` — ส่งรูปไปยัง Python CLIP Worker และรับ 512-dim Embedding กลับมา**

คลาสนี้ทำหน้าที่เดียวคือ **HTTP POST `/embed`** ไปที่ Python Worker ที่รัน `open_clip` (ViT-B/32) พร้อม retry 2 ครั้งกรณีที่ Worker ยังไม่พร้อม:

```csharp
public async Task<List<float[]>> GetEmbeddingsAsync(
    List<string> imageDataUrls,
    CancellationToken cancellationToken = default)
{
    // รับ list ของ data URL (base64 JPEG/PNG) ส่งไปพร้อมกันครั้งเดียว
    var payload = new { images = imageDataUrls };

    const int maxRetries = 2;
    for (int attempt = 1; attempt <= maxRetries; attempt++)
    {
        try
        {
            // POST http://localhost:5000/embed  ← Python CLIP Worker
            var response = await _httpClient.PostAsJsonAsync(
                $"{_baseUrl}/embed", payload, JsonOptions, cancellationToken);
            response.EnsureSuccessStatusCode();

            var body = await response.Content.ReadFromJsonAsync<EmbedResponse>(JsonOptions, cancellationToken);
            // EmbedResponse.Embeddings: List<List<float>> — 1 vector ต่อ 1 รูปภาพ
            return body?.Embeddings.Select(x => x.ToArray()).ToList()
                   ?? new List<float[]>();
        }
        catch (Exception ex) when (attempt < maxRetries)
        {
            Console.WriteLine($"CLIP worker attempt {attempt} failed: {ex.Message}");
        }
    }
    return new List<float[]>(); // คืน empty ถ้า fail ทุก attempt
}
// config: appsettings.json -> "ClipWorker": { "BaseUrl": "http://localhost:5000" }
```

> **ทำไมส่งพร้อมกันหลายรูป?** Python Worker รัน CLIP batch inference — ส่ง N รูปครั้งเดียวเร็วกว่าส่งทีละรูป N ครั้งมาก (GPU amortization)

---

**[2] `PostEmbeddingIndexingService.cs` — Index เวกเตอร์ของโพสต์ใหม่เข้าฐานข้อมูล (Background)**

เมื่อผู้ขายสร้างโพสต์ใหม่ ระบบจะรัน indexing ใน **background task** (fire-and-forget ไม่ block response):

```csharp
public async Task IndexPostImagesAsync(string postId, IReadOnlyList<string> imageUrls, ...)
{
    var dataUrls = new List<string>();
    var meta     = new List<(string SourceImageUrl, int CardIndex)>();

    foreach (var imageUrl in imageUrls)
    {
        // 1) ดาวน์โหลดรูปจาก Supabase Storage
        var bytes = await _httpClient.GetByteArrayAsync(imageUrl, cancellationToken);

        // 2) Crop การ์ดออกมา (CardDetectionService — Emgu.CV 6-step)
        using var ms  = new MemoryStream(bytes);
        var cards = await _cardDetection.DetectAndCropAsync(ms, cancellationToken);

        if (cards.Count > 0)
        {
            // พบการ์ด -> embed แต่ละใบแยกกัน (1 โพสต์ = หลาย embedding)
            for (int i = 0; i < cards.Count; i++)
            {
                dataUrls.Add(cards[i].ImageUrl);
                meta.Add((imageUrl, i));
            }
        }
        else
        {
            // ไม่พบการ์ด -> fallback ใช้ทั้งรูปเป็น 1 embedding
            dataUrls.Add("data:image/jpeg;base64," + Convert.ToBase64String(bytes));
            meta.Add((imageUrl, 0));
        }
    }

    // 3) Batch CLIP embed ทุกรูปพร้อมกัน -> float[512] ต่อรูป
    var embeddings = await _clipEmbedding.GetEmbeddingsAsync(dataUrls, cancellationToken);

    // 4) Insert ลงตาราง post_image_embeddings ใน Supabase
    var rows = Enumerable.Range(0, embeddings.Count).Select(i =>
        new Dictionary<string, object>
        {
            ["postId"]         = postId,
            ["sourceImageUrl"] = meta[i].SourceImageUrl,
            ["cardIndex"]      = meta[i].CardIndex,
            ["embedding"]      = embeddings[i]   // float[] -> pgvector vector(512)
        }).ToList();

    await _supabaseService.InsertManyAsync("post_image_embeddings", rows, useServiceRole: true);
}
```

---

**[3] `POST /api/card-detection/search` — Endpoint ค้นหาโพสต์ด้วยรูปภาพ** (`CardDetectionController.cs`)

Endpoint ที่ Frontend เรียกเมื่อผู้ใช้กด "ค้นหาด้วยภาพ" — ทำงาน 3 ขั้นตอน:

```csharp
[HttpPost("search")]
[RequestSizeLimit(30_000_000)]   // รับ max 30 MB
public async Task<IActionResult> SearchSimilar([FromForm] List<IFormFile>? images, ...)
{
    // ----- 1) Crop การ์ดออกจากรูปที่ผู้ใช้ส่งมา --------------------------------
    var dataUrls = new List<string>();
    foreach (var image in images)
    {
        var detectedCards = await _cardDetection.DetectAndCropAsync(stream, cancellationToken);
        foreach (var card in detectedCards)
        {
            dataUrls.Add(card.ImageUrl);        // data:image/jpeg;base64,...
            if (dataUrls.Count >= 12) break;    // MaxQueryCards = 12
        }
    }

    // ----- 2) CLIP Embed การ์ดจาก query -----------------------------------------
    var queryEmbeddings = await _clipEmbedding.GetEmbeddingsAsync(dataUrls, cancellationToken);
    // ได้ N vectors (float[512]) — 1 vector ต่อ 1 การ์ดที่ crop เจอ

    // ----- 3) RPC Supabase หา post ที่ embedding คล้ายกัน -----------------------
    var postIdToScore = new Dictionary<string, double>();
    foreach (var embedding in queryEmbeddings)
    {
        // แปลง float[] -> "[0.1,-0.2,...]" สำหรับ pgvector text format
        var vectorStr = "[" + string.Join(",",
            Array.ConvertAll(embedding,
                x => x.ToString("G", CultureInfo.InvariantCulture))) + "]";

        var rpcParams = new Dictionary<string, object>
        {
            ["query_embedding"] = vectorStr,
            ["match_limit"]     = 30,       // ดึงสูงสุด 30 โพสต์ ต่อ 1 embedding
            ["match_status"]    = "active",
            ["match_threshold"] = MinSimilarityScore  // default 0.92 (configurable via ImageSearch:MinSimilarityScore)
        };

        var rows = await _supabaseService.RpcAsync(
            "match_posts_by_embedding", rpcParams, useServiceRole: true);

        // Merge: ถ้า postId เดิมมาจากหลาย query card -> เก็บ score สูงสุด
        foreach (var row in rows)
        {
            var postId = row["postId"]?.ToString();
            var score  = Convert.ToDouble(row["score"]);
            if (!postIdToScore.TryGetValue(postId, out var best) || score > best)
                postIdToScore[postId] = score;
        }
    }

    // เรียง score -> fetch ข้อมูลโพสต์จริง -> return ให้ Frontend
    foreach (var (postId, score) in postIdToScore.OrderByDescending(x => x.Value).Take(12))
    {
        var post = await _supabaseService.GetAsync("posts", postId, useServiceRole: true);
        post["imageSearchScore"] = score;   // แนบ score ให้ Frontend แสดงผล
        posts.Add(post);
    }
    return Ok(new { success = true, posts, matchedCards = queryEmbeddings.Count });
}
```

> **ทำไม merge แบบ best-score?** รูป 1 ใบอาจมีหลายการ์ด ระบบ embed แต่ละใบแยกกัน ถ้าโพสต์ A มีการ์ดที่ตรงกับ query card ตัวใดตัวหนึ่งก็เพียงพอ ใช้ score สูงสุดในการ rank

---

**[4] SQL `match_posts_by_embedding` — pgvector HNSW ANN Search**

ฟังก์ชันรันใน PostgreSQL ของ Supabase ใช้ Operator `<=>` ของ **pgvector** = **Cosine Distance** (= 1 - Cosine Similarity):

```sql
-- score = 1 - cosine_distance  =>  ยิ่งสูง (ใกล้ 1.0) = การ์ดคล้ายกันมาก
CREATE OR REPLACE FUNCTION match_posts_by_embedding(
  query_embedding  text,                       -- "[0.1, -0.2, ...]" 512 มิติ
  match_limit      int     DEFAULT 20,
  match_status     text    DEFAULT 'active',
  match_threshold  double precision DEFAULT 0.0,
  match_category   text    DEFAULT NULL
)
RETURNS TABLE("postId" uuid, score double precision)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v vector(512);
BEGIN
  v := query_embedding::vector(512);    -- cast text -> pgvector type
  RETURN QUERY
  SELECT
    e."postId",
    (1 - (e.embedding <=> v))::double precision AS score  -- <=> = cosine distance
  FROM post_image_embeddings e
  INNER JOIN posts p ON p.id = e."postId"
  WHERE p.status = match_status
    AND (1 - (e.embedding <=> v)) >= match_threshold      -- กรอง similarity floor
    AND (match_category IS NULL OR p.category = match_category)
  ORDER BY e.embedding <=> v   -- distance ต่ำสุด = similarity สูงสุด
  LIMIT match_limit;
END; $$;

-- HNSW Index — ค้นหา ANN O(log n) ไม่ใช่ O(n)
CREATE INDEX IF NOT EXISTS idx_post_image_embeddings_embedding
  ON post_image_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
-- m=16           : link ต่อ node (สูง = แม่นขึ้น / build นานขึ้น)
-- ef_construction: candidate pool ขณะ build (ใหญ่ = แม่นกว่า)
```

> **ทำไม HNSW?** แม่นกว่า IVFFlat, ไม่ต้องกำหนด `nprobe` ล่วงหน้า, รองรับ collection ที่ยังเติบโตได้ดี

---

**ภาพรวม Flow ค้นหาด้วยรูปภาพ (End-to-End):**

```
[User: POST /api/card-detection/search]  <- multipart/form-data รูปภาพ
    |
[CardDetectionService]  <- Emgu.CV 6-step: crop การ์ด -> data URL base64
    |
[ClipEmbeddingService]  <- HTTP POST /embed -> Python open_clip ViT-B/32
    |  float[512] per card (L2-normalized)
[Supabase RPC match_posts_by_embedding]  <- pgvector HNSW <=> cosine distance
    |  (postId, score) pairs
[Backend: fetch post data + attach imageSearchScore]
    |
[Frontend: แสดงรายการโพสต์เรียงตาม similarity score]
```

### 3.2 โมเดลจำแนกภาพอีดิทตัดต่อและ AI-Generated (Heuristic Ensemble & Sightengine)
การตรวจสอบรูปปลอมและสวมรอยในระบบปัจจุบันใช้ **2 ระบบ** ทำงานร่วมกันเพื่อความรัดกุม ภายใต้คลาส `PostModerationAiService.cs`:

**1. คลาสวิเคราะห์สถิติภาพ Local Heuristic (`ImageManipulationDetectionService.cs`):**
ระบบการตรวจจับด้วยการคำนวณสถิติพิกเซลและความถี่ของพื้นที่ภาพ (ไม่ต้องใช้ GPU) โดยวิเคราะห์ **17 สัญญาณความผิดปกติ** แบ่งเป็น:
- **Manipulation Signals (11 ชนิด - จับภาพตัดต่อ Splicing):**
  - **Multi-level ELA:** หาความผิดปกติของการบีบอัด JPEG ซ้ำซ้อนที่หลงเหลือตามขอบรูปที่แปะเข้ามา
  - **Color Channel Correlation / JPEG Ghost:** จับคู่ความสัมพันธ์ระหว่างสีและรอยต่อคุณภาพรูป เมื่อถูกก๊อปปี้จากคนละภาพมาแปะรวมกัน
  - **Local Laplacian & Wavelet Noise:** การประเมินความไม่เนียนของคลื่นความถี่ Noise ถ้ารูปถูกแก้ไขตัดต่อ ค่าความแปรปรวน (Variance) ในแต่ละ Tile (32x32) จะสูงผิดปกติ
- **AI-Generation Signals (6 ชนิด - จับภาพโคลนเทียม Diffusion/GAN):**
  - **Multi-scale noise floor / High-Freq Ratio:** ภาพ AI ทั่วไปจะเนียนเรียบผิดปกติ เมื่อวัดเรโซแนนซ์ความถี่สูง (High-Freq) แล้วไร้ Noise เม็ดเล็กๆ ซึ่งภาพถ่ายกล้องจริงต้องมีสะสมอยู่
  - **Color Palette Uniformity:** ภาพสุ่ม AI มีการกระจายตัวของสีที่เป็นระเบียบ (Uniform) มากกว่าภาพถ่ายออร์แกนิค
- **สมการหาความเสี่ยง:** ใช้ **Sigmoid Normalization** บีบสเกลช่วงค่าคะแนน โดยมีการปรับเทียบใหม่ (v2 calibration) ให้สเกลกว้างขึ้นสำหรับรูปการ์ด เพื่อลด False Positive (เนื่องจากการ์ดมีการพิมพ์สีจัดจ้านและขอบชัดเจน) จากนั้นรวมด้วย Weighted Average พร้อมตัวคูณความสอดคล้อง (Concordance Analysis)
- **Composite Signature Override:** หากระบบเจอค่า Edge Incoherence และ JPEG Ghost พุ่งสูงพร้อมกัน (พฤติกรรมของการตัดต่อแบบ Cut-and-Paste อย่างหยาบ) ระบบจะบังคับดันค่าความเสี่ยงขึ้นระดับ Danger ทันทีโดยไม่ต้องสน Weighted Average

**2. Deep Learning Service (Sightengine):**
แพลตฟอร์มนอกใช้วิเคราะห์ทบทวนภาพ AI อีกชั้นด้วยสถาปัตยกรรม **CNNs (Convolutional Neural Networks)** เช่น ResNet ในการหารอยต่อลายน้ำ (Artifacts) ที่ซ่อนอยู่แบบที่สูตร Local Matrix ด้านบนอาจตกหล่น
- โมเดลเทรนผ่าน **Binary Cross-Entropy Loss** สกัดผลด้วยฟังก์ชัน **Sigmoid** ($\sigma(z) = \frac{1}{1 + e^{-z}}$) ทำให้ตัวเลขถูกพ่นออกมาเป็นความน่าจะเป็นตั้งแต่ 0 ถึง 1 ตามมาตรฐาน AI กลาง

---

#### 🔑 โค้ดหลักของระบบตรวจจับภาพตัดต่อและภาพ AI

**[1] ฟังก์ชัน `AnalyzeAsync` — จุดเริ่มต้นของการวิเคราะห์ภาพ** (`ImageManipulationDetectionService.cs`)

ฟังก์ชันนี้คือ orchestrator หลัก รับ `byte[]` ของรูปภาพแล้วรัน 17 สัญญาณพร้อมกัน จากนั้นรวมผลด้วย Weighted Average + Concordance เพื่อคำนวณ `ManipulationRiskPct` และ `AiGeneratedRiskPct` สุดท้าย:

```csharp
// ── Manipulation signals (11 ชุด) ──────────────────────────────────────────
var elaScore          = ComputeMultiElaScore(img);         // ELA 4 ระดับคุณภาพ
var noiseInconsistency = ComputeNoiseInconsistency(gray);  // CoV Laplacian noise
var satAnomaly        = ComputeSaturationAnomaly(img);     // CoV ความอิ่มสี
var edgeIncoherence   = ComputeEdgeIncoherence(gray);      // CoV Canny edge density
var blockiness        = ComputeBlockiness(gray);            // JPEG 8×8 block boundary
var lumConsistency    = ComputeLuminanceConsistency(gray); // gradient ความสว่าง
var sharpConsistency  = ComputeSharpnessConsistency(gray); // CoV Laplacian variance
var colorCorrelation  = ComputeColorChannelCorrelation(img);// Pearson R-G-B correlation
var jpegGhost         = ComputeJpegGhostScore(img);        // native quality distribution
var waveletNoise      = ComputeWaveletNoiseInconsistency(gray); // Haar HH sub-band CoV
var spatialFreq       = ComputeSpatialFrequencyConsistency(gray); // Laplacian+Sobel CoV

// แปลงค่าดิบเป็นค่าความเสี่ยง 0-85% ด้วย Sigmoid Normalization
var elaRisk    = SigmoidNormalize(elaScore, 16, 36, 3);
var noiseRisk  = SigmoidNormalize(noiseInconsistency, 0.50, 1.25, 3);
// ... (สัญญาณอื่นๆ ในลักษณะเดียวกัน)

// รวมผลด้วย Weighted Average ตามน้ำหนักที่ calibrate มาเฉพาะภาพการ์ดตลาด
var manipWeights = new[] { 0.16, 0.07, 0.06, 0.08, 0.10, 0.08, 0.13, 0.09, 0.10, 0.07, 0.06 };
var rawManipRisk = WeightedAverage(manipSignals, manipWeights);

// คูณด้วย Concordance Factor — ถ้าสัญญาณหลายตัวชี้ไปทางเดียวกัน ความน่าเชื่อถือยิ่งสูง
var manipConcordance  = ComputeConcordance(manipSignals);
var manipulationRisk  = Math.Clamp(rawManipRisk * manipConcordance.Factor, 0, 92);

// ── AI-generation signals (6 ชุด ใช้ Inverse Sigmoid — ค่าต่ำ = เสี่ยงสูง)
var smoothRisk  = SigmoidNormalizeInverse(noiseFloor, 0.8, 4.0, 5);
var hfRisk      = SigmoidNormalizeInverse(hfRatio, 0.08, 0.28, 5);
// ...
var aiWeights   = new[] { 0.20, 0.17, 0.14, 0.18, 0.15, 0.16 };
var rawAiRisk   = WeightedAverage(aiSignals, aiWeights);
var aiConcordance = ComputeConcordance(aiSignals);
var aiGenRisk   = Math.Clamp(rawAiRisk * aiConcordance.Factor, 0, 90);
```

> **ทำไมต้องใช้ Sigmoid แทน Linear?** ค่าดิบของสัญญาณแต่ละตัวมีช่วงต่างกันมาก (เช่น ELA ตั้งแต่ 0-100+ แต่ noiseInconsistency อยู่แค่ 0-3) การบีบด้วย Sigmoid ทำให้ outlier รุนแรงไม่ระเบิดค่าสุดท้าย ผลลัพธ์จึง robust กว่า

---

**[2] `ComputeMultiElaScore` — Error Level Analysis หลายระดับ**

ELA (Error Level Analysis) คือเทคนิคยอดนิยมด้านนิติดิจิทัล (Digital Forensics) ทำงานโดยบีบอัด JPEG ซ้ำแล้วหาผลต่างกับต้นฉบับ บริเวณที่ถูกตัดต่อมาจากภาพอื่นจะมี error level แตกต่างจากบริเวณรอบข้างอย่างเห็นได้ชัด:

```csharp
// รัน ELA ที่ 4 ระดับ quality ต่างกัน ให้น้ำหนักต่างกัน
(int quality, double weight)[] levels = { (60, 0.15), (70, 0.30), (80, 0.35), (92, 0.20) };

private static double ComputeElaAtQuality(Mat img, int quality)
{
    // 1. Re-encode เป็น JPEG ที่ quality ที่กำหนด
    CvInvoke.Imencode(".jpg", img, buffer,
        new KeyValuePair<ImwriteFlags, int>(ImwriteFlags.JpegQuality, quality));

    // 2. คำนวณ pixel-wise absolute difference กับต้นฉบับ ขยาย 10x เพื่อให้มองเห็น
    CvInvoke.AbsDiff(img, recompressed, diff);
    CvInvoke.ConvertScaleAbs(diff, scaled, 10.0, 0);

    // 3. หา Mean + StdDev ของ ELA map
    CvInvoke.MeanStdDev(scaled, ref mean, ref std);
    var overallLevel  = (mean.V0 + mean.V1 + mean.V2) / 3.0;
    var overallSpread = (std.V0  + std.V1  + std.V2)  / 6.0;

    // 4. หา Regional Outlier Score — กี่ % ของ tile ที่มีค่า ELA > mean+2σ
    // บริเวณที่แปะมาจากภาพอื่นจะเป็น "hotspot" ที่โดดเด่นออกมา
    var outlierScore = ComputeRegionalOutlierScore(grayEla, 24);

    // ผสมค่ารวมกับ outlier — outlier ชั่งน้ำหนัก 45% เพราะจับ localized splice ได้แม่นกว่า
    return (overallLevel + overallSpread) * 0.55 + outlierScore * 14.0 * 0.45;
}
```

---

**[3] `ComputeJpegGhostScore` — JPEG Ghost Detection**

เทคนิคนี้ตรวจจับว่าแต่ละ tile ถูกบันทึกมาจาก JPEG quality ระดับใดก่อนหน้า ถ้าภาพถูก splice มาจากหลายแหล่ง แต่ละ region จะ "prefer" quality ที่ต่างกัน ทำให้การกระจาย mode ไม่สม่ำเสมอ:

```csharp
// ทดสอบ quality 12 ระดับ (51-95, step 4)
int[] testQualities = { 51, 55, 59, 63, 67, 71, 75, 79, 83, 87, 91, 95 };

// หาว่าแต่ละ tile ให้ ELA ต่ำที่สุดที่ quality ใด → นั่นคือ "native quality" ของ tile นั้น
for (int t = 0; t < tileCount; t++)
{
    int bestQi = qualityErrors.Select((err, qi) => (err[t], qi))
                              .OrderBy(x => x.Item1)
                              .First().qi;
    bestQualityIndices[t] = bestQi;
}

// วัด dispersion ของ native quality ข้ามทุก tile
// (ภาพปกติ = tile ทุกอันมี native quality เหมือนกัน)
double qStd = Math.Sqrt(bestQualityIndices.Average(q => (q - qMean) * (q - qMean)));

// วัด fraction ของ tile ที่ "หลุดจาก mode" → บอกว่ามี region ที่มาจากแหล่งอื่น
double outlierFraction = 1.0 - (double)modeCount / tileCount;

return qStd * 1.5 + outlierFraction * 8.0;
```

---

**[4] `ComputeColorChannelCorrelation` — Pearson Correlation ระหว่าง R-G-B**

เมื่อภาพถูกถ่ายในสภาพแสงเดียวกัน ช่อง R, G, B จะมี correlation สม่ำเสมอทั่วภาพ แต่ถ้า paste region มาจากแสงอีกชุด correlation จะเปลี่ยนไปเฉพาะจุด:

```csharp
// คำนวณ Pearson correlation ระหว่างแต่ละคู่ช่องสีใน tile 32×32
rgCorrs.Add(PearsonCorrelation(rData, gData, tileSize));
gbCorrs.Add(PearsonCorrelation(gData, bData, tileSize));
rbCorrs.Add(PearsonCorrelation(rData, bData, tileSize));

// วัด CoV ของแต่ละ correlation map ข้ามทุก tile
// CoV สูง = correlation ของสีไม่สม่ำเสมอ = likely splice
double rgCoV = ComputeCoV(rgCorrs);
double gbCoV = ComputeCoV(gbCorrs);
double rbCoV = ComputeCoV(rbCorrs);
return (rgCoV + gbCoV + rbCoV) / 3.0;

// Pearson: cov(A,B) / (σ_A × σ_B) — standard correlation formula
private static double PearsonCorrelation(Image<Gray, byte> a, Image<Gray, byte> b, int tileSize)
{
    double cov  = sumAB / n - meanA * meanB;
    double stdA = Math.Sqrt(Math.Max(0, sumA2 / n - meanA * meanA));
    double stdB = Math.Sqrt(Math.Max(0, sumB2 / n - meanB * meanB));
    return Math.Clamp(cov / (stdA * stdB), -1, 1);
}
```

---

**[5] สัญญาณตรวจจับภาพ AI — `ComputeMultiScaleNoiseFloor` & `ComputeHighFreqRatio`**

ภาพจากกล้องจริงมี Sensor Noise เม็ดเล็กๆ กระจายทั่วภาพ ซึ่งภาพ AI จาก Stable Diffusion / DALL·E / Midjourney จะขาดสิ่งนี้ เนื่องจากกระบวนการ synthesis ทำให้ภาพ "เรียบ" ผิดธรรมชาติ:

```csharp
// วัด residual ที่ 3 kernel size — ภาพ AI จะให้ค่า total ต่ำทุกขนาด
(int kernelSize, double weight)[] scales = { (3, 0.30), (5, 0.45), (9, 0.25) };
foreach (var (ksize, weight) in scales)
{
    CvInvoke.GaussianBlur(gray, blurred, new Size(ksize, ksize), 0);
    CvInvoke.AbsDiff(gray, blurred, residual);    // residual = noise
    CvInvoke.MeanStdDev(residual, ref mean, ref std);
    total += mean.V0 * weight;
}
// ค่า noiseFloor ต่ำ = ภาพเรียบผิดปกติ → AI risk สูง (ใช้ SigmoidNormalizeInverse)

// HF/MF ratio: ภาพจริงมี high-freq noise > mid-freq energy, ภาพ AI กลับกัน
CvInvoke.AbsDiff(gray, blurWeak, highFreq);        // HF = gray - Gaussian(3)
CvInvoke.AbsDiff(blurWeak, blurStrong, midFreq);   // MF = Gaussian(3) - Gaussian(15)
return meanHF.V0 / (meanMF.V0 + 1e-6);            // ratio ต่ำ = AI-like
```

---

**[6] `ComputeConcordance` — IQR-based Concordance Analysis**

แทนการนับว่ากี่สัญญาณที่ "trigger" ระบบใช้ Interquartile Range (IQR) วัดว่าสัญญาณทั้งหมดเห็นตรงกันมากแค่ไหน ถ้าสัญญาณหลายตัวชี้ไปทิศเดียวอย่างสม่ำเสมอ → โบนัส factor; ถ้าสัญญาณกระจายขัดแย้งกัน → ลด factor ป้องกัน false positive:

```csharp
private static ConcordanceResult ComputeConcordance(double[] scores)
{
    var sorted = scores.OrderBy(s => s).ToArray();
    double q1 = sorted[n / 4],  q3 = sorted[3 * n / 4];
    double iqr = q3 - q1;
    double normalizedIqr = iqr / 80.0;  // ช่วงคะแนน 5-85 → IQR max ≈ 80

    if (normalizedIqr < 0.19)           // สัญญาณ "แน่น" → เห็นตรงกัน
    {
        if (median >= 55)               // เห็นด้วยว่าเสี่ยงสูง
            factor = 1.0 + 0.15 * (1.0 - normalizedIqr);  // บวก +15% สูงสุด
        else if (median <= 30)          // เห็นด้วยว่าปลอดภัย
            factor = 1.0 - 0.12 * (1.0 - normalizedIqr);  // ลด -12% สูงสุด
    }
    else if (normalizedIqr < 0.38)      // สัญญาณกระจายปานกลาง
        factor = 0.95;
    else                                // สัญญาณขัดแย้งกันมาก → ระแวดระวัง
        factor = 0.88;

    // ผลสุดท้าย: manipulationRisk = rawRisk × factor → clamp 0-92
    var manipulationRisk = Math.Clamp(rawManipRisk * factor, 0, 92);
}
```

---

**[7] การตัดสินคลาสสุดท้าย (`reason` field)**

เมื่อได้ `manipulationRisk` และ `aiGenRisk` แล้ว ระบบตัดสินป้ายชื่อโดยดูว่าฝั่งไหนชนะ:

```csharp
if      (aiGenRisk >= 52 && aiGenRisk > manipulationRisk + 6)        reason = "ai-generated";
else if (manipulationRisk >= 52 && manipulationRisk > aiGenRisk + 6) reason = "manipulation";
else if (aiGenRisk >= 38 || manipulationRisk >= 38)                  reason = "mixed-signals";
else                                                                  reason = "heuristic";

// WarningLevel threshold (PostModerationAiService.cs)
// manipulation: >= 75 → "danger", >= 52 → "warning", else → "safe"
// ai-generated: >= 58 → "danger", >= 35 → "warning", else → "safe"
```

### 3.3 Google Lens (Reverse Image Search / Visual Search)
Google Lens เป็นการขยายขอบเขตของ Vector space ให้เชื่อมเข้ากับฐานข้อมูลภาพเว็บอื่นๆ ระดับสเกลโลก
- **Feature Extraction:** ตัว Google Lens จะไม่ได้วิเคราะห์แค่ความคล้ายทางพิกเซลรูปโดยรวม แต่จะดึงเอา **Keypoints** (รายละเอียดจุดตัด โค้ง สี) ขึ้นมาเทียบ Signature เฉพาะตัว
- **Approximate Nearest Neighbor (ANN):** เพื่อที่จะเทียบกับรูปภาพเวกเตอร์หลายสิบล้านรูปพร้อมๆ กัน ต้องใช้อัลกอริทึม **Vector Quantization** และโครงสร้าง Index แบบต้นไม้กราฟ ($O(\log n)$) ช่วยให้การค้นหาภาพมีความเร็วระดับมิลลิวินาที

---

#### 🔑 โค้ดหลักของระบบค้นหาภาพจากเว็บ (Reverse Image Search)

**[1] ฟังก์ชัน `AnalyzeAsync` — เรียก SerpAPI Google Lens แล้วประมวลผลผล** (`ExternalReverseImageService.cs`)

ฟังก์ชันนี้ส่ง URL ของรูปภาพไปให้ **SerpAPI Google Lens** (mode = `exact_matches`) ซึ่งคือการค้นหาหน้าเว็บที่ภาพ **เหมือนกันทุกพิกเซล** (ไม่ใช่แค่คล้าย) จากนั้นคำนวณ `RiskPct` จากจำนวนและแหล่งของผลที่พบ:

```csharp
// type=exact_matches = ค้นหาเฉพาะเว็บที่ใช้รูป "เดิม" พอดี
// (เทียบเท่ากับกดแท็บ "ค้นหาภาพเหมือน" ใน Google Lens มือถือ)
var apiUrl = $"https://serpapi.com/search.json"
           + $"?engine=google_lens&type=exact_matches"
           + $"&url={Uri.EscapeDataString(imageUrl)}"
           + $"&api_key={Uri.EscapeDataString(apiKey)}";

// รองรับ retry 2 ครั้ง กรณี timeout
for (int attempt = 1; attempt <= 2; attempt++)
{
    response = await client.GetAsync(apiUrl, cancellationToken);
    break; // ถ้าสำเร็จ — ออก loop
    // กรณี timeout: รอ 2 วินาทีแล้วลองใหม่
}

// อ่านผลจาก "exact_matches" array (fallback: "matches" → "visual_matches")
var allMatchesArray = GetArrayProperty(root, "exact_matches")
    ?? GetArrayProperty(root, "matches")
    ?? GetArrayProperty(root, "visual_matches")
    ?? new List<JsonElement>();
```

---

**[2] การแยกผลลัพธ์ตาม Target Marketplace — `ExtractAllMatchDetails`**

ระบบแยกแยะว่า URL ที่พบมาจาก **Mercari / Yahoo Auctions JP / Magi** (เว็บประมูลการ์ดเป้าหมาย) หรือจากเว็บทั่วไป เพราะการเจอรูปซ้ำบนเว็บเหล่านี้มีนัยยะสำคัญว่า "ภาพนี้ถูกขโมยมาจากผู้ขายรายอื่น":

```csharp
// รายชื่อ fragment ของ marketplace ที่สนใจ (configurable ใน appsettings)
private List<string> GetTargetMarketplaceHostFragments() =>
    new() { "mercari", "auctions.yahoo.co.jp", "magi.care", "magi.jp" };

// สำหรับแต่ละผลลัพธ์จาก Google Lens:
foreach (var item in allMatchesArray)
{
    var link     = item["link"].GetString();
    var thumbUrl = GetStringProperty(item, "thumbnail")  // URL รูปย่อ (เล็ก/เร็ว)
               ?? GetStringProperty(item, "image");      // fallback: URL รูปเต็ม

    var isMarketplace = IsTargetMarketplaceHost(link, fragments);
    results.Add((link, thumbUrl, isMarketplace));
}

// จัดเรียง: marketplace มาก่อน เพื่อให้ CLIP เปรียบเทียบภาพสำคัญก่อน
var candidateImageUrls = allMatchDetails
    .OrderByDescending(x => x.IsTargetMarketplace)
    .Where(x => !string.IsNullOrWhiteSpace(x.ThumbUrl))
    .Select(x => x.ThumbUrl)
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .Take(14)   // จำกัด 14 URL — ป้องกัน API call ท่วม
    .ToList();
```

---

**[3] สูตรคำนวณ `RiskPct` จากผลการค้นหา**

ระบบ score ความเสี่ยงโดยดู 2 มิติ: (1) พบใน Mercari/Yahoo/Magi หรือไม่ (2) พบกี่เว็บรวม:

```csharp
if (targetMarketplaceMatchCount >= 1)
{
    // พบรูปเดิมบน Mercari/Yahoo/Magi ตรงๆ = เสี่ยงสูงมาก
    level = "near";
    risk  = Math.Min(85d, 65d + (targetMarketplaceMatchCount * 8d));
    // → 1 ลิงก์ = 73%, 2 ลิงก์ = 81%, 3+ ลิงก์ = 85% (cap)
}
else if (matchCount >= 3)
{
    // พบในเว็บทั่วไปหลายแห่ง = น่าจะก๊อปปี้มาจากที่อื่น
    level = "near";
    risk  = Math.Clamp(45d + (matchCount * 5d), 45d, 75d);
}
else if (matchCount >= 1)
{
    level = "weak";
    risk  = Math.Clamp(30d + (matchCount * 8d), 30d, 55d);
}
```

---

**[4] `ComputeDHashSimilarityAsync` — ยืนยันด้วย dHash (Perceptual Hash)** (`PostModerationAiService.cs`)

หลังจากได้ URL ภาพ thumbnail จาก Google Lens มาแล้ว ระบบจะดาวน์โหลดมา **เปรียบเทียบพิกเซลด้วย dHash** เพื่อยืนยันว่าเป็น "ภาพเดิม" จริงๆ ไม่ใช่แค่ "การ์ดชนิดเดียวกัน" ที่คนอื่นโพสต์:

```csharp
// dHash: resize เป็น 9×8 grayscale → เปรียบพิกเซลซ้อน-ขวาใน row เดียวกัน → 64-bit fingerprint
private static ulong ComputeDHash(byte[] imageBytes)
{
    CvInvoke.Resize(img, resized, new Size(9, 8), interpolation: Inter.Area);
    // 8 rows × 8 column-pairs = 64 bits
    ulong hash = 0; int bit = 0;
    for (int row = 0; row < 8; row++)
        for (int col = 0; col < 8; col++)
        {
            // ถ้า pixel ซ้ายน้อยกว่า pixel ขวา → bit = 1
            if (data[row * step + col] < data[row * step + col + 1])
                hash |= (1UL << bit);
            bit++;
        }
    return hash;
}

// วัดความแตกต่างด้วย Hamming Distance (นับ bit ที่ต่างกัน)
private static int HammingDistance(ulong a, ulong b) => BitOperations.PopCount(a ^ b);

// แปลง distance → % similarity
var distance = HammingDistance(postHash, thumbHash);
var simPct   = (1.0 - distance / 64.0) * 100.0;
// 0-10 bits differ ≈ same photo, >20 bits ≈ different photo

// ถ้า simPct >= 88% → ยืนยัน exact match → ExternalSourceRiskPct = max(current, 92%)
const int ConfirmThreshold = 12; // Hamming distance <= 12/64 → confirmed
if (distance <= ConfirmThreshold && isMarketplace)
    marketplaceConfirmed.Add(link);
```

---

**[5] `ComputeExternalCompositionSimilarityAsync` — เปรียบ CLIP Embedding ทั้งภาพ**

สุดท้าย ระบบส่งรูปภาพโพสต์ + รูป thumbnail จากเว็บที่พบเข้า **CLIP Worker** เพื่อเปรียบเทียบ "ความคล้ายองค์ประกอบทั้งภาพ" (composition similarity) — วิธีนี้ต่างจาก dHash ตรงที่ทนต่อการ compress/resize ซ้ำมากกว่า แต่อาจ false positive กับการ์ดชนิดเดียวกัน จึงใช้ร่วมกับ dHash:

```csharp
// ดาวน์โหลด thumbnail จากเว็บ (สูงสุด 8 ภาพ) แล้วแปลงเป็น base64 data URL
foreach (var u in candidateImageUrls.Take(8))
{
    var bytes = await httpClient.GetByteArrayAsync(u, cancellationToken);
    embedInputs.Add($"data:image/{ext};base64," + Convert.ToBase64String(bytes));
}

// ส่งเข้า CLIP Worker — ได้ 512-dim vector ต่อรูป
var embeddings = await _clipEmbeddingService.GetEmbeddingsAsync(embedInputs, cancellationToken);

// หา cosine similarity สูงสุดกับทุก candidate
var query = embeddings[0];  // รูปโพสต์
var best  = embeddings.Skip(1).Max(e => CosineSimilarity(query, e));

// แปลง [-1,1] → [0,100]%
var pct = Math.Clamp((best + 1d) * 50d, 0d, 100d);

// ตัดสิน warning level (ใน ComputeSourceWarningLevel)
// >= 88% = "danger" (ภาพทั้งภาพคล้ายกันมาก = ขโมยมา)
// >= 72% = "warning" (คล้ายพอสงสัย)
// < 72%  = "safe"
```

**Cache Layer:** ทุก request ไป SerpAPI จะถูก cache ไว้ใน `ConcurrentDictionary` โดยใช้ SHA-256 hash ของ URL เป็น key เพื่อไม่ให้เรียก API ซ้ำสำหรับรูปเดิมภายใน 30 นาที (freshMinutes) และ fallback stale cache ได้ถึง 24 ชั่วโมง (staleHours) หากเรียก API ไม่สำเร็จ:

```csharp
private static string BuildCacheKey(string imageUrl)
{
    var normalized = imageUrl.Trim() + "|" + ScoringVersion; // version bump invalidates old cache
    var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
    return Convert.ToHexString(bytes);
}
```

---

### 3.4 การตรวจจับและครอปรูปภาพการ์ดอัตโนมัติ (Automated Card Detection & Cropping)
ระบบฝั่งโค้ด `CardDetectionService.cs` (ปัจจุบัน ~1,119 บรรทัด) มีโครงสร้างใช้ไลบรารี **Emgu.CV** เข้ามาช่วยมาร์คจุดและคว้านครอปตัวการ์ดก่อนส่งต่อให้โมเดล AI ตัวอื่น โดยมีกลยุทธ์ทำงานแบบขั้นบันได (Heuristic Approach) **6 ขั้นตอน** ดังนี้:

#### ขั้นที่ 0: Color-based Background Segmentation (ฟังก์ชัน `TryColorBackgroundMask`)
**แนวคิด:** ก่อนจะหาขอบการ์ด ระบบจะพยายามแยก "พื้นหลัง" (โต๊ะ/แผ่นรอง) ออกจาก "วัตถุ" (การ์ด) ก่อนเป็นอันดับแรก

**วิธีการ:**
- สุ่มตัวอย่างพิกเซลจากขอบทั้ง 4 ด้านของภาพ (Top/Bottom/Left/Right border strips) เพื่อประมาณสีพื้นหลังเฉลี่ยในปริภูมิสี **HSV** (Hue, Saturation, Value)
- คำนวณค่าเบี่ยงเบนมาตรฐาน (Standard Deviation) ของ S และ V เขตขอบ → ถ้า `sStd > 45` หรือ `vStd > 55` แปลว่าพื้นหลังไม่สม่ำเสมอ → ข้ามขั้นตอนนี้
- ถ้าพื้นหลังสม่ำเสมอ → สร้างหน้ากากสีขาว/ดำ (Binary Mask): พิกเซลที่สีห่างจากค่าเฉลี่ยมาก = สีขาว (เป็นวัตถุ/การ์ด) โดยคำนวณระยะสีถ่วงน้ำหนัก `dist = dh*1.2 + ds*0.6 + dv*0.5` ถ้า `dist > 35` → foreground
- ทำ Morphological Close + Open กำจัดรูพรุนในหน้ากาก

**ผลลัพธ์:** หน้ากากสีขาว-ดำ (Foreground Mask) ที่บอกว่าตรงไหนเป็นวัตถุ ส่งให้ขั้นตอนตรวจจับ Contour ใช้เป็นแหล่งข้อมูลเสริม

---

#### ขั้นที่ 1: Projection-based Grid Detection (ฟังก์ชัน `TryGridDetection`)
**แนวคิด:** ถ่ายรูปแผงการ์ดเรียงกันบนโต๊ะ → ระหว่างการ์ดจะมีช่องว่างพื้นเรียบ → ค่า Gradient จะตกเป็นหุบเขา

**วิธีการ:**
- แปลงภาพเป็น Grayscale → Gaussian Blur (5×5, σ=1.5)
- คำนวณ **Sobel Filter** ทั้งแกน X และ Y → รวมเป็น Gradient Magnitude
- สร้าง **Projection Profile** สองทิศทาง:
  - `vProfile[x]` = ค่าเฉลี่ย Gradient ที่คอลัมน์ x (ดูเป็นแนวตั้ง)
  - `hProfile[y]` = ค่าเฉลี่ย Gradient ที่แถว y (ดูเป็นแนวนอน)
- Smooth ด้วย **Gaussian Kernel** (window=13, σ=window/4) — ใช้ Gaussian แทน Box Filter เพราะทนต่อ Spike ของพิกเซลกวนได้ดีกว่า
- หาช่วง **Band** (profile ≥ threshold) = ตำแหน่งคอลัมน์/แถวของการ์ด, ช่วงที่ต่ำกว่า threshold = ช่องว่างระหว่างการ์ด
- ถ้า Band ใหญ่เกินไป (การ์ดชนกัน) → ใช้ `SplitOversizedBands` หา Local Minima เพื่อแบ่งย่อย
- ตัดเป็นกริดเซลล์ (Column × Row) → ประยุกต์ใช้ **Robust Local Cell Tightening** โดยหาระดับ Gradient สูงสุด (Peak) ภายในเซลล์ย่อยนั้นๆ เพื่อใช้เป็น Local Threshold (15% ของค่า Peak) ในการบีบกรอบซ้ายขวาบนล่างให้แนบสนิทกับขอบการ์ดมากที่สุด แก้ปัญหาไขว้กันของตาราง ก่อนนำไปตรวจ Aspect Ratio + Size Uniformity

**ผลลัพธ์:** รายการ Rectangle ของการ์ดที่จำได้จากกริด (≥ 2 ใบถึงจะใช้ผลนี้)

---

#### ขั้นที่ 2: Multi-Scale Contour Detection (ฟังก์ชัน `MultiScaleContourDetection` + `ContourDetection`)
**แนวคิด:** ถ้าการ์ดไม่ได้เรียงเป็นกริด → ใช้วิธีหาเส้นขอบ (Contour) ที่สเกลหลายระดับ

**วิธีการ:**
- รันที่ **3 สเกล** (1×, 0.75×, 0.5×) เพื่อจับการ์ดทั้งใบใหญ่ใบเล็กในภาพความละเอียดสูง — แต่ละสเกลจะ Resize ภาพลง แล้วแมปผลลัพธ์กลับมาพิกัดต้นฉบับ
- แต่ละสเกลเรียก `ContourDetection` ที่ภายในทำขั้นตอน:
  1. **Equalize Histogram** → Gaussian Blur (5×5) → **Adaptive Threshold** (GaussianC, block=31, C=7)
  2. **Otsu's Threshold** → ใช้ค่า Otsu เป็นตัวกำหนด **Adaptive Canny** (`low = otsu×0.33`, `high = otsu×1.1`) — ทำให้ค่า threshold ปรับตามความเข้มแสงของภาพจริงแทนการใช้ค่าตายตัว
  3. **Morphological Close** (kernel 7×7, 2 รอบ) + **Dilate** (kernel 3×3) → **BitwiseOr** รวม Edge ทุกช่องทาง
  4. ถ้ามี background mask จากขั้นที่ 0 → ใส่เป็น source เสริมอีก 1 ช่องทาง
  5. **FindContours** บนแหล่ง edge ทั้งหมด → กรอง:
     - สี่เหลี่ยม 4 จุด (Convex Quad) ที่ Aspect Ratio ตรง → เก็บจุดมุม 4 จุดไว้สำหรับ Perspective Correction
     - Contour ปิดทรงอื่นที่หาได้จากกรอบสี่เหลี่ยมแบบล้อมรอบตามองศาเอียง (RotatedRect) ซึ่งมี Ratio และ Area ผ่านเกณฑ์ โดยระบบจะ**ยกเลิกข้อจำกัด Aspect Ratio ขั้นต่ำ** ของกรอบขอบขนาน (Bounding Box) แบบปกติ เพื่อรองรับการ์ดที่วางตัวเอียงหรือหมุนมุมทแยงโดยไม่ถูกโยนทิ้ง
- Deduplicate ข้ามสเกลด้วยข้อกำหนดทาง Overlap ที่เข้มงวดมากกว่าเดิม (ลดปัญหาภาพซ้อน)

**ผลลัพธ์:** รายการ Rectangle ของการ์ดทั้งหมดที่หาพบจากทุกสเกล

---

#### ขั้นที่ 3: Grid Completion (ฟังก์ชัน `CompleteGrid`)
**แนวคิด:** ถ้าพบการ์ดวางเรียงเป็นแพทเทิร์นตารางแต่มีบางช่องหายไป (ฟันหลอ) → คำนวณอนุมาน

**วิธีการ:**
- กลุ่มการ์ดที่ขนาดใกล้ค่ามัธยฐาน (±38%) คือ "Dominant size"
- จัดกลุ่มเป็นแถว (Row) ตามตำแหน่ง Y-center (tolerance = 40% ความสูงค่ามัธยฐาน)
- หาแถวที่มีการ์ดมากที่สุด → ใช้ตำแหน่ง X ของการ์ดในแถวนั้นเป็น Reference Column
- แถวที่มีการ์ดน้อยกว่า maxCols → คำนวณ Median Width/Height เติมการ์ดเข้าช่องที่ไม่ Overlap กับรูปที่พบแล้ว

**ผลลัพธ์:** รายการ Rectangle ที่ปิดช่องว่างเรียบร้อย

---

#### ขั้นที่ 4: Scoring — Texture + Text + Border Contrast
เมื่อรวบรวมผู้สมัครทั้งหมดแล้ว ระบบจะให้คะแนนแต่ละกรอบด้วย **3 มิติ** เพื่อตัดสินว่าเป็นการ์ดจริงหรือไม่:

**4a. Texture Score (ฟังก์ชัน `TextureScore`):**
- ตัดภาพ Grayscale เฉพาะ ROI → หาค่าเบี่ยงเบนมาตรฐาน (StdDev) → Sobel Gradient Magnitude → StdDev
- **สูตร:** `score = grayStd × 0.42 + gradientStd × 0.58`
- การ์ดจริงมีลวดลาย Artwork → Score สูง, พื้นโต๊ะเรียบ → Score ต่ำ

**4b. MSER Text-Likelihood Score (ฟังก์ชัน `TextLikelihoodScore`):**
อัลกอริทึม **MSER (Maximally Stable Extremal Regions)** ใช้ตรวจจับพื้นที่ที่มีรูปร่างคล้ายตัวอักษร:
- สร้าง MSER detector ด้วยพารามิเตอร์: `delta=5`, `minArea=8`, `maxArea=2%ของ ROI`, `maxVariation=0.25`, `minDiversity=0.2`
- กรอง Region ที่พื้นที่อยู่ระหว่าง 0.01% - 1.5% ของ ROI (ขนาดตัวอักษร) และ Aspect Ratio ≥ 0.15 (ไม่ใช่เส้นบางๆ)
- **สูตร:** `score = min(1.0, textLikeCount / 30.0)` — ถ้ามี ≥ 30 กลุ่มคล้ายตัวอักษร → score อิ่มตัวที่ 1.0
- **Hard Gate:** ค่า `textLikelihood` จะถูกใช้เป็น**ประตูลิมิต (Gate)** — ถ้าภาพไม่มีตัวอักษรเลย (`< 0.05`) คะแนนรวมจะถูกคูณด้วย `0.08` ทำให้แทบไม่มีทางถูกเลือกเป็นการ์ด

**4c. Border Contrast Score (ฟังก์ชัน `BorderContrastScore`):**
วัดความแตกต่างสีระหว่าง "ขอบในของกรอบ" กับ "พิกเซลรอบนอกกรอบ":
- สุ่มตัวอย่างพิกเซลเป็นแถบบางๆ (`stripW = w/20`) ด้านในขอบ + แถบนอกขอบ (`outerW = w/15`) ทั้ง 4 ด้าน
- **สูตร:** `contrast = |innerMean - outerMean| / 255.0`
- การ์ดจริงมีขอบที่ตัดกับพื้นหลังชัด → contrast สูง, ชิ้นส่วนย่อยภายในการ์ด (ศิลปะกึ่งกลาง) → contrast ต่ำ (พิกเซลนอกกรอบยังเป็นส่วนหนึ่งของการ์ดเองไม่ใช่พื้นหลัง)

**สูตรคะแนนรวม:**
```
score = TextureScore × (0.40 + 0.35 × AspectFit + 0.25 × TextLikelihood)
        × TextGate × BorderGate
```

---

#### ขั้นที่ 5: Size Consistency + Deduplication + Final Cleanup
- **Size Consistency:** ถ้ามีผู้สมัคร ≥ 3 ตัว → คำนวณพื้นที่ของผู้สมัครอันดับใน Top 25% เป็น "ขนาดอ้างอิง" → ตัดผู้สมัครที่เล็กกว่า 30% ของขนาดอ้างอิงทิ้ง (เป็นชิ้นส่วนแหว่ง)
- **Overlap Deduplication:** ตรวจ Overlap ทีละตัว — ถ้าพื้นที่ซ้อน > 25% ของผู้สมัครรายย่อยหรือรายที่ยอมรับแล้ว → ตัดทิ้ง
- **Final Size Cleanup:** คำนวณพื้นที่ค่ามัธยฐาน (Median Area) ของการ์ดที่ผ่าน → ตัดตัวที่ < 28% ของ median ทิ้ง (Safety net สุดท้าย)
- **Crop & Encode:** กรอบที่รอดจะขยายขอบ Padding 1.2% แล้วครอปจากภาพต้นฉบับ เข้ารหัส JPEG → Base64 data URL

---

### 3.5 ค่าพารามิเตอร์คงที่ของโค้ดอัลกอริทึม (Algorithm Configurations)
เพื่อให้การทำงาน Computer Vision ไวและแม่นกับภาพการ์ดเกม จึงมีการกำหนดค่าตัวแปรคงที่ (Constants) เจาะจง:

| ตัวแปร | ค่า | เหตุผล |
|---|---|---|
| `CardAspect` | `2.5/3.5` ≈ 0.714 | อัตราส่วนมาตรฐานสากลของ Trading Card (2.5″ × 3.5″) ใช้กับ Pokemon, Yu-Gi-Oh!, MTG |
| `MinAspectRatio` / `MaxAspectRatio` | 0.50 – 0.92 | เผื่อภาพถ่ายมุมเอียง (Perspective Distortion) ที่ทำให้สัดส่วนคลาดเคลื่อนจาก 0.714 |
| `MaxAspectDeviationStrict` | 0.18 | ช่วง deviation สำหรับ Convex Quad ที่เจอชัดเจน → เข้มงวดกว่า |
| `MaxAspectDeviationFallback` | 0.22 | ช่วง deviation สำหรับ Contour ทรงอื่น → ผ่อนปรนกว่าเล็กน้อย |
| `MinCardAreaPixels` | 5,000 px² | ป้องกันการ์ดจิ๋วพิกเซลขยะ (Noise) ที่ไม่ใช่การ์ดจริง |
| `MaxProcessWidth` | 1,800 px | Resize ภาพ 4K ลงมาก่อนประมวลผล → ลด CPU/RAM โดยไม่สูญเสียขอบการ์ด |
| `MaxCardsReturned` | 24 | จำกัดการ์ดสูงสุดต่อภาพ ป้องกัน Memory Exhaustion ยามเจอลวดลายกระเบื้อง |
| `CropPaddingFraction` | 0.012 (1.2%) | เผื่อขอบนิดๆ กันครอปฉีกกินเนื้อ Artwork ด้านในการ์ด |
| `MinInnerToOuterAreaRatio` | 0.12 | สำหรับกำจัดกรอบนอก (Outer Frame) ที่ครอบการ์ดด้านใน — ถ้าการ์ดในกรอบ ≥ 12% ของกรอบนอก → ตัดกรอบนอกทิ้ง |

---

### 3.6 ระบบโพสต์ที่เกี่ยวข้อง (Related Posts — `RelatedPostsService.cs`)
เมื่อผู้ใช้เปิดดูหน้า PostDetail ระบบจะแสดง **โพสต์ที่เกี่ยวข้อง** โดยใช้ CLIP Embedding เดิมที่ index ไว้ในขั้นตอน Post-Creation Pipeline:

**วิธีการ:**
1. ดึง embedding ของโพสต์ปัจจุบันจากตาราง `post_image_embeddings` (สูงสุด 3 embeddings)
2. เรียก RPC `match_posts_by_embedding` ด้วย **threshold ต่ำกว่า** การค้นหาด้วยรูป:
   - **Image Search:** `MinSimilarityScore = 0.92` (ตั้งค่าผ่าน `ImageSearch:MinSimilarityScore`) → ต้องตรงกันเกือบเป๊ะ
   - **Related Posts:** `MinSimilarityScore = 0.65` (ตั้งค่าผ่าน `RelatedPosts:MinSimilarityScore`) → ยอมรับความคล้ายในระดับกลาง
3. ถ้าผลลัพธ์จาก CLIP ไม่พอ → เติมด้วยโพสต์ในหมวดหมู่เดียวกัน (category-based fallback)
4. กรองเฉพาะโพสต์ที่ `status = "active"` และอยู่ในหมวดหมู่เดียวกัน

```csharp
// RelatedPostsService.cs — threshold ต่ำกว่า ImageSearch
private const double DefaultRelatedMinSimilarity = 0.65;

// ดึง embedding ของโพสต์ปัจจุบัน → RPC match → เรียงตาม score
var rpcParams = new Dictionary<string, object>
{
    ["query_embedding"] = vectorStr,
    ["match_limit"]     = effectiveLimit + 8,
    ["match_status"]    = "active",
    ["match_threshold"] = threshold,           // 0.65 default
    ["match_category"]  = category             // กรองหมวดหมู่เดียวกัน
};
```

> **ทำไม threshold ต่างกัน?** Image Search ต้องการความแม่นยำสูง (precision-oriented) — ผู้ใช้ต้องการหาโพสต์ที่มีการ์ดเหมือนกัน ส่วน Related Posts ต้องการ recall สูง — แสดงโพสต์ที่ "คล้ายคลึง" เพื่อเพิ่มการค้นพบสินค้าใหม่ๆ

---

### 3.7 สรุปตารางพอร์ตและ Endpoint สำคัญ (Ports & Key Endpoints)

| Service | Port | หน้าที่หลัก |
|---|---|---|
| `client-web` (React/Vite) | `5173` | Frontend UI สำหรับผู้ใช้งานและ Admin |
| `server-api` (ASP.NET Core) | `5072` | Backend API: auth, posts, cards, moderation, orders |
| `clip-worker` (FastAPI/Python) | `5000` | CLIP ViT-B/32 embedding: `/embed` endpoint |

| Endpoint | Method | หน้าที่ |
|---|---|---|
| `/api/card-detection/detect` | POST | Detect/crop การ์ดจากรูปภาพ |
| `/api/card-detection/search` | POST | ค้นหาโพสต์ด้วยรูปภาพ (CLIP + pgvector) |
| `/api/admin/ai-screening/{postId}` | GET | AI moderation แบบรวม (source + manipulation + AI-gen) |
| `/api/admin/ai-screening/{postId}/source` | GET | ตรวจจับแหล่งที่มาภาพ (Reverse Image Search) |
| `/api/admin/ai-screening/{postId}/manipulation` | GET | ตรวจจับภาพตัดต่อ + ภาพ AI |
| `/embed` (clip-worker) | POST | รับ base64 images → ส่งคืน 512-dim embeddings |

---

> [!NOTE]
> ด้วยคู่มือกะทัดรัดฉบับนี้ เราจะได้เห็นว่ากลยุทธ์ฟีเจอร์ AI รูปภาพในโปรเจกต์ ทำงานผ่าน **2 กระบวนการอิสระ** — (A) Post-Creation Pipeline ที่สร้าง embedding อัตโนมัติเมื่อผู้ขายลงโพสต์ กับ (B) Admin-Triggered Moderation ที่รันระบบ AI Screening 3 ด้าน (source/manipulation/AI-gen) เมื่อ Admin กดตรวจสอบ — ตั้งแต่การสกัดตัดเสียงสัญญาณกวนทิ้ง (Emgu.CV — 6 ขั้นตอน ตั้งแต่แยกสีพื้นหลัง, กริด, Contour, เติมช่อง, ให้คะแนน MSER/Border, จนถึงครอปสุดท้าย) ยืนยันความเป็นภาพเดิมด้วย dHash (Perceptual Hash) คัดกรองภาพ AI (Sightengine + Local Heuristic 17 สัญญาณ) หาความคล้ายองค์ประกอบภาพ (CLIP Composition Similarity) และหา DNA คล้ายคลึงในอาร์เรย์เวกเตอร์ 512 มิติ (CLIP + pgvector HNSW) ถือเป็นสถาปัตยกรรมเบื้องหลังที่ยึดหลักคณิตศาสตร์ด้านเรขาคณิตผสาน Vector Database จนมีประสิทธิภาพฉับไวและแม่นยำสูงเหนือชั้นกว่าเสิร์ชคำปกติ
