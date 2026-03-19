"""
CLIP embedding worker for lens-like image search.
Uses open_clip (ViT-B-32) to produce 512-dim embeddings. No API cost.
"""
import base64
import io
import re
from typing import List

import open_clip
import torch
from PIL import Image
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="CLIP Embedding Worker")

# Load model once at startup (ViT-B-32 -> 512 dims)
_model = None
_preprocess = None
_device = None


@app.on_event("startup")
def load_model():
    global _model, _preprocess, _device
    _device = "cuda" if torch.cuda.is_available() else "cpu"
    _model, _, _preprocess = open_clip.create_model_and_transforms(
        "ViT-B-32", pretrained="openai"
    )
    _model = _model.to(_device).eval()
    # Ensure 512 dim (ViT-B-32 openai is 512)
    dim = _model.visual.output_dim
    assert dim == 512, f"Expected 512, got {dim}"


def _decode_data_url(data_url: str) -> bytes:
    """Extract base64 payload from data:image/...;base64,XXX or raw base64 string."""
    s = data_url.strip()
    if s.startswith("data:"):
        m = re.match(r"data:image/[^;]+;base64,(.+)", s)
        if not m:
            raise ValueError("Invalid data URL")
        s = m.group(1)
    return base64.b64decode(s.replace(" ", "").replace("\n", ""))


def _image_to_tensor(raw: bytes) -> torch.Tensor:
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    t = _preprocess(img).unsqueeze(0).to(_device)
    return t


class EmbedRequest(BaseModel):
    images: List[str]  # base64 data URLs or raw base64 strings (with or without data: prefix)


class EmbedResponse(BaseModel):
    embeddings: List[List[float]]  # list of 512-dim vectors


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    if not req.images:
        raise HTTPException(status_code=400, detail="images list is empty")
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    embeddings_list = []
    for data_url in req.images:
        try:
            raw = _decode_data_url(data_url)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image payload: {e}")
        try:
            t = _image_to_tensor(raw)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Image decode failed: {e}")
        with torch.no_grad():
            emb = _model.encode_image(t)
            emb = emb / emb.norm(dim=-1, keepdim=True)  # L2 normalize for cosine
        vec = emb.cpu().float().numpy()[0].tolist()
        embeddings_list.append(vec)

    return EmbedResponse(embeddings=embeddings_list)


@app.get("/health")
def health():
    return {"status": "ok", "model": "ViT-B-32", "dim": 512}
