import asyncio
import json
import random
import time
from dataclasses import dataclass, asdict
from typing import Optional, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware


@dataclass
class RainState:
    groundHits: int = 0
    paused: bool = False
    rainRate: int = 0
    connectedClients: int = 0
    tick: int = 0


app = FastAPI(title="Pixel Rain Arena Backend", version="0.1.0")

# Hackathon mode: permissive CORS keeps GitHub Pages, localhost, tunnels, and phones easy.
# Tighten this list before using the backend for anything beyond a demo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

state = RainState()
clients: Set[WebSocket] = set()
state_lock = asyncio.Lock()
broadcast_task: Optional[asyncio.Task] = None


def now_ms() -> int:
    return int(time.time() * 1000)


def snapshot_payload() -> dict:
    payload = asdict(state)
    payload["type"] = "state"
    payload["serverTs"] = now_ms()
    return payload


async def broadcast(payload: dict) -> None:
    stale_clients: list[WebSocket] = []

    for websocket in list(clients):
        try:
            await websocket.send_json(payload)
        except RuntimeError:
            stale_clients.append(websocket)

    for websocket in stale_clients:
        clients.discard(websocket)


async def ticker() -> None:
    while True:
        await asyncio.sleep(0.25)

        async with state_lock:
            if not state.paused:
                increment = random.randint(1, 8)
                state.groundHits += increment
                state.rainRate = increment * 4
            else:
                state.rainRate = 0

            state.connectedClients = len(clients)
            state.tick += 1
            payload = snapshot_payload()

        await broadcast(payload)


@app.on_event("startup")
async def start_ticker() -> None:
    global broadcast_task
    broadcast_task = asyncio.create_task(ticker())


@app.on_event("shutdown")
async def stop_ticker() -> None:
    if broadcast_task:
        broadcast_task.cancel()


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


@app.get("/snapshot")
async def snapshot() -> dict:
    async with state_lock:
        return snapshot_payload()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    clients.add(websocket)

    async with state_lock:
        state.connectedClients = len(clients)
        await websocket.send_json(snapshot_payload())

    try:
        while True:
            raw_message = await websocket.receive_text()
            message = json.loads(raw_message)
            message_type = message.get("type")

            if message_type == "ping":
                await websocket.send_json(
                    {
                        "type": "pong",
                        "serverTs": now_ms(),
                        "clientTs": message.get("clientTs"),
                    }
                )
                continue

            async with state_lock:
                if message_type == "control":
                    state.paused = bool(message.get("paused"))
                elif message_type == "reset":
                    state.groundHits = 0
                    state.rainRate = 0

                state.connectedClients = len(clients)
                payload = snapshot_payload()

            await broadcast(payload)
    except WebSocketDisconnect:
        pass
    finally:
        clients.discard(websocket)
        async with state_lock:
            state.connectedClients = len(clients)
            payload = snapshot_payload()

        await broadcast(payload)
