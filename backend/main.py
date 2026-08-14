import asyncio
import logging
from contextlib import asynccontextmanager
from typing import List, Any, Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .database import db_pool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# WebSocket Connection Manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"Client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Failed to send message to client: {e}")
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()


async def broadcast_message(message: str):
    await manager.broadcast(message)


# ---------------------------------------------------------------------------
# App Lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await db_pool.connect()
    logger.info("Database connected — starting background scheduler...")

    from .scheduler import background_scheduler
    task = asyncio.create_task(background_scheduler())

    yield

    # Shutdown
    task.cancel()
    await db_pool.disconnect()
    logger.info("Shutdown complete.")


# ---------------------------------------------------------------------------
# App Initialization
# ---------------------------------------------------------------------------

app = FastAPI(
    title="RTSAS — Real-Time Sepsis Alert System API",
    description="Backend API for the sepsis monitoring dashboard",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# REST Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    return {"status": "healthy", "db": db_pool.pool is not None}


@app.get("/api/patients")
async def get_patients():
    """
    Return today's patient list with computed NEWS scores.
    Sorted by NEWS score descending (highest risk first).
    """
    from .scheduler import get_patients_cache, fetch_vitals_from_db, build_patient_list

    # If cache is empty (e.g., first request before scheduler ran), fetch immediately
    cache = get_patients_cache()
    if not cache:
        rows = await fetch_vitals_from_db()
        cache = build_patient_list(rows)

    # Sort by NEWS score descending
    sorted_patients = sorted(cache, key=lambda p: p.get("news_result", {}).get("totalScore", 0), reverse=True)
    return JSONResponse(content={"patients": sorted_patients, "count": len(sorted_patients)})


@app.get("/api/patients/{hn}")
async def get_patient(hn: str):
    """Return a single patient by HN."""
    from .scheduler import get_patients_cache

    cache = get_patients_cache()
    patient = next((p for p in cache if p.get("hn") == hn), None)
    if patient is None:
        return JSONResponse(status_code=404, content={"detail": f"Patient HN={hn} not found"})
    return JSONResponse(content=patient)


# ---------------------------------------------------------------------------
# WebSocket Endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep alive — client just listens for broadcasts
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
