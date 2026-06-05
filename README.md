# Pixel Rain Arena

Pixel Rain Arena is a free, hackathon-ready mock of an Evolution Arena style architecture. It is a static GitHub Pages frontend that looks alive by itself, plus an optional local FastAPI WebSocket backend exposed through Cloudflare Quick Tunnel or ngrok for real latency testing.

The game is a retro pixel rain mini-game: dark rainy canvas, falling blocky drops, splash pixels, a glowing ground line, live counters, latency telemetry, QR sharing, and mobile-first touch controls.

## What Works

- Local-only mode: no backend needed, all rain and counters run in the browser.
- Live backend mode: connect to `/ws` for shared pause, reset, ground-hit count, connected clients, and latency.
- Runtime backend URL config: paste localhost, Cloudflare, ngrok, `ws://`, or `wss://` without rebuilding GitHub Pages.
- PWA shell: installable metadata and a small service worker for app-shell caching.

## Local Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

Useful commands:

```bash
npm run build
npm run preview
```

## Local Backend

Use Python 3.11 when possible.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Check:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/snapshot
```

In the frontend, paste `http://localhost:8000` into Live backend connection and click Connect.

## Phone Test On Same Wi-Fi

1. Start the frontend with `npm run dev`.
2. Start the backend with Uvicorn.
3. Open the frontend from your computer's LAN IP, for example `http://192.168.1.10:5173`.
4. Paste the backend LAN URL, for example `http://192.168.1.10:8000`.
5. Scan the generated QR code with your phone.

## Cloudflare Quick Tunnel

Start the backend locally on port 8000, then run:

```bash
cloudflared tunnel --url http://localhost:8000
```

Copy the generated `https://*.trycloudflare.com` URL. Paste it into the frontend backend URL input and click Connect. The app converts it to `wss://.../ws` automatically. Use the generated share QR to let a phone join the same live backend session.

## ngrok Fallback

Start the backend locally on port 8000, then run:

```bash
ngrok http 8000
```

Copy the generated `https://*.ngrok-free.app` URL. Paste it into the frontend backend URL input and click Connect.

## GitHub Pages

1. Push this repo to GitHub under `AishwaryaVathada/pixel-rain-arena`.
2. In GitHub, go to Settings, Pages, and set Source to GitHub Actions.
3. Push to `main` or run the workflow manually.
4. Open the Pages URL and scan the QR code.

The workflow sets `VITE_BASE_PATH=/pixel-rain-arena/` for repository Pages. If you rename the repo, update `.github/workflows/deploy-pages.yml`. For a custom domain, use `/` or remove the env var.

## Runtime URL Formats

The Live backend connection panel accepts all of these:

```text
http://localhost:8000
https://random.trycloudflare.com
https://random.ngrok-free.app
ws://localhost:8000/ws
wss://random.trycloudflare.com/ws
```

You can also open the frontend with:

```text
?ws=wss://example.trycloudflare.com/ws
```

If `?ws=` exists, the app auto-connects. Saved backend URLs are stored in `localStorage`.

## Controls

- Touch or click and hold the canvas to pause.
- Release to resume.
- Press Space to toggle pause.
- Press R or click Reset to reset the counter.

## What Is Mocked vs Real

Mocked:

- No real AI game engine.
- No cloud VM.
- No database.
- Rain state is simulated in memory.

Real:

- Static GitHub Pages frontend.
- Canvas game loop.
- Optional WebSocket backend.
- Shared pause/reset/count state.
- Ping/pong latency measurements.
- QR share URL flow for phones.

## Hackathon Demo Script

1. Open the frontend and point out local-only mode.
2. Touch and hold the rain. The rain pauses instantly and the counter stops.
3. Release to resume.
4. Start the backend and connect to `http://localhost:8000`.
5. Show latency, packets per minute, reconnects, and connected clients.
6. Expose the backend with Cloudflare Quick Tunnel or ngrok.
7. Paste the tunnel URL, click Connect, and scan the QR from a phone.
8. Pause from one device and show the shared state on another.

