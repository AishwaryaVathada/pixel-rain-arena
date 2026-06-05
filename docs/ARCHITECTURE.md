# Pixel Rain Arena Architecture

Pixel Rain Arena is a beginner-friendly static-first mock of an Evolution Arena style architecture.

## Static Frontend

The `frontend/` app is a Vite + React + TypeScript PWA. It renders the rain procedurally with HTML Canvas and CSS, so no external GIFs or images are required. Local-only mode runs fully in the browser and keeps the demo alive even with no backend.

## Optional Live Backend

The `backend/` app is FastAPI + Uvicorn. It exposes:

- `GET /health`
- `GET /snapshot`
- `WebSocket /ws`

The backend keeps shared state in memory: `groundHits`, `paused`, `rainRate`, `connectedClients`, and `tick`. Every 250 ms it broadcasts state to all connected clients. Any client can pause, resume, or reset the shared state.

## Tunnel Layer

Cloudflare Quick Tunnel or ngrok can expose the local backend to phones and teammates. The GitHub Pages frontend does not need rebuilding because the backend URL is runtime-configurable in the UI and can also be passed with `?ws=...`.

## Mocked vs Real

Mocked:

- No AI game engine.
- No cloud VM.
- No database or persistence.
- Backend rain counts are simulated.

Real:

- Static deploy path.
- Canvas interaction.
- WebSocket pause/reset messages.
- Ping/pong latency telemetry.
- Mobile QR share flow.

