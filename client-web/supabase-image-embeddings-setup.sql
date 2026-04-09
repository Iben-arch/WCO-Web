-- ============================================
-- Image Embeddings (CLIP) + pgvector for lens-like search
-- ============================================
-- รันใน Supabase Dashboard > SQL Editor
-- ต้องเปิด extension vector (pgvector) ก่อน
-- ============================================

-- 1. เปิดใช้ extension pgvector (ถ้าโปรเจกต์ยังไม่มี)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. สร้างตารางเก็บ embedding ของการ์ดที่ crop จากรูปโพสต์
-- embedding dimension 512 ตรงกับ open_clip ViT-B-32
CREATE TABLE IF NOT EXISTS post_image_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "postId" UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  "sourceImageUrl" TEXT NOT NULL,
  "cardIndex" INTEGER NOT NULL DEFAULT 0,
  embedding vector(512) NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_image_embeddings_post_id ON post_image_embeddings("postId");
-- HNSW index for fast approximate nearest neighbor (cosine distance)
CREATE INDEX IF NOT EXISTS idx_post_image_embeddings_embedding ON post_image_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 3. RLS
ALTER TABLE post_image_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage post_image_embeddings" ON post_image_embeddings;
CREATE POLICY "Service role can manage post_image_embeddings" ON post_image_embeddings
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Anyone can read post_image_embeddings" ON post_image_embeddings;
CREATE POLICY "Anyone can read post_image_embeddings" ON post_image_embeddings
  FOR SELECT USING (true);

-- 4. RPC: ค้นหาโพสต์ที่คล้ายกับ query embedding หนึ่งตัว (cosine distance)
-- ลบ overload เก่า (double precision[]) ถ้ามี เพื่อไม่ให้ PostgREST งง (PGRST203)
DROP FUNCTION IF EXISTS match_posts_by_embedding(double precision[], int, text);
-- ลบเวอร์ชัน 3 พารามิเตอร์ (text) ก่อนสร้างใหม่ที่มี match_threshold
DROP FUNCTION IF EXISTS match_posts_by_embedding(text, int, text);

-- รับ query_embedding เป็น text รูปแบบ '[0.1, -0.2, ...]' (pgvector)
-- คืน (postId, score) โดย score = 1 - cosine_distance (ยิ่งสูงยิ่งคล้าย; โดยทั่วไป ~0–1)
-- match_threshold: กรองเฉพาะคู่ที่ similarity >= ค่านี้ (0 = ไม่กรอง เหมือนเดิม)
-- match_category: กรองเฉพาะโพสต์ในหมวดเดียวกัน (NULL = ไม่กรอง)
CREATE OR REPLACE FUNCTION match_posts_by_embedding(
  query_embedding text,
  match_limit int DEFAULT 20,
  match_status text DEFAULT 'active',
  match_threshold double precision DEFAULT 0.0,
  match_category text DEFAULT NULL
)
RETURNS TABLE(
  "postId" uuid,
  score double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v vector(512);
BEGIN
  v := query_embedding::vector(512);
  RETURN QUERY
  SELECT
    e."postId",
    (1 - (e.embedding <=> v))::double precision AS score
  FROM post_image_embeddings e
  INNER JOIN posts p ON p.id = e."postId"
  WHERE p.status = match_status
    AND (1 - (e.embedding <=> v)) >= match_threshold
    AND (match_category IS NULL OR p.category = match_category)
  ORDER BY e.embedding <=> v
  LIMIT match_limit;
END;
$$;

-- หมายเหตุ:
-- 1. Server ส่ง query_embedding เป็น string "[0.1, -0.2, ...]" (ความยาว 512)
-- 2. ใช้ service_role key เมื่อเรียก RPC เพื่อ bypass RLS ถ้าต้องการ
-- 3. Backend ควรเรียก match_posts_by_embedding ต่อหนึ่ง query card แล้วรวมผลจากหลาย embedding
