# CLIP Embedding Worker

Self-hosted worker for CLIP image embeddings (512-dim). Used by server-api for lens-like search. No API cost.

## Setup

```bash
cd clip-worker
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --host 0.0.0.0 --port 5002
```

Default port: **5002** (server-api already uses 5000/5001). If you use another port, set `ClipWorker:BaseUrl` in server-api appsettings to match (e.g. `http://localhost:5002`).

## API

- `POST /embed` — Body: `{ "images": ["data:image/jpeg;base64,...", ...] }`. Returns `{ "embeddings": [[float, ...], ...] }` (512 floats per image).
- `GET /health` — Returns `{ "status": "ok", "model": "ViT-B-32", "dim": 512 }`.
