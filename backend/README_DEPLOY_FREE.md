# Pixel Rain Arena Backend: Free Local/Tunnel Deploy

This backend is intentionally tiny: FastAPI, one in-memory shared rain state, and a WebSocket at `/ws`.

## Local Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Check it:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/snapshot
```

## Cloudflare Quick Tunnel

```bash
cloudflared tunnel --url http://localhost:8000
```

Copy the generated `https://*.trycloudflare.com` URL, paste it into the frontend's live backend panel, and click Connect.

## ngrok Fallback

```bash
ngrok http 8000
```

Copy the generated `https://*.ngrok-free.app` URL, paste it into the frontend, and click Connect.

## Notes

This is hackathon-mode infrastructure. CORS is permissive, state is in memory, and all state resets when the backend restarts. No secrets, databases, paid services, or OpenAI API calls are used.

