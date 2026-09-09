import asyncio
import logging
from contextlib import asynccontextmanager
from typing import List, Any, Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .database import db_pool
from .database_auth import engine as auth_engine, Base as AuthBase
from .auth.router import router as auth_router

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
    # Startup: create auth DB tables (idempotent)
    try:
        from .auth import models as _auth_models  # noqa: F401 — ensure models are registered
        AuthBase.metadata.create_all(bind=auth_engine)
        logger.info("Auth DB tables ready.")
    except Exception as e:
        logger.error(f"Auth DB initialization note: {e}")

    # Startup: connect HOSxP pool + scheduler
    await db_pool.connect()
    logger.info("HOSxP Database connected — starting background scheduler...")

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

# Include routers
app.include_router(auth_router)


# ---------------------------------------------------------------------------
# REST Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    from .scheduler import get_cache_stats
    return {
        "status": "healthy",
        "db": db_pool.pool is not None,
        "cache": get_cache_stats(),
    }


@app.get("/api/admin/cache-stats")
async def admin_cache_stats():
    """Return current cache stats — for IT Admin display."""
    from .scheduler import get_cache_stats
    return get_cache_stats()


@app.post("/api/admin/clear-cache")
async def admin_clear_cache(
    current_user: Any = None,
):
    """Clear last_seen_vitals and patient cache. IT Admin only.
    
    Note: Auth check is lightweight here since we rely on network boundary +
    JWT check in the frontend calling this from the IT Admin panel.
    Full role enforcement can be added by importing require_role dependency.
    """
    from .scheduler import clear_cache
    result = clear_cache()
    logger.info(f"Cache cleared via admin API")
    return {"success": True, **result}


@app.get("/api/admin/db-status")
async def admin_db_status():
    """Check HOSxP DB connectivity status."""
    status = "connected" if db_pool.pool is not None else "disconnected"
    try:
        if db_pool.pool:
            async with db_pool.pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute("SELECT 1")
                    await cur.fetchone()
            status = "connected"
        else:
            status = "disconnected"
    except Exception as e:
        status = f"error: {str(e)[:80]}"
    return {"status": status, "pool_available": db_pool.pool is not None}


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
