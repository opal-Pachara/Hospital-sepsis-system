import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import List, Any, Dict, Optional
from pydantic import BaseModel

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Request
from fastapi.exceptions import RequestValidationError
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

    # Ensure centralized patient_treatment_status table exists
    try:
        from .treatment_service import init_treatment_table
        await init_treatment_table()
    except Exception as e:
        logger.error(f"Error initializing treatment table: {e}")

    from .scheduler import background_scheduler
    task = asyncio.create_task(background_scheduler())

    yield

    # Shutdown
    task.cancel()
    try:
        await task
    except (asyncio.CancelledError, Exception):
        pass
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

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    msgs = []
    for err in exc.errors():
        msg = err.get("msg", "")
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, "):]
        msgs.append(msg)
    error_detail = " | ".join(msgs) if msgs else "ข้อมูลที่ส่งมาไม่ถูกต้อง"
    return JSONResponse(
        status_code=422,
        content={"detail": error_detail},
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


class ClearCacheRequest(BaseModel):
    preserve_hns: Optional[List[str]] = None


@app.post("/api/admin/clear-cache")
async def admin_clear_cache(
    payload: Optional[ClearCacheRequest] = None,
    current_user: Any = None,
):
    """Clear last_seen_vitals and patient cache. IT Admin only.
    
    If preserve_hns is provided, records and vitals for patients currently
    undergoing active treatment/timers are preserved.
    """
    from .scheduler import clear_cache
    preserve_hns = payload.preserve_hns if payload else None
    result = clear_cache(preserve_hns=preserve_hns)
    logger.info(f"Cache cleared via admin API (preserved HNs: {preserve_hns})")
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
async def get_patients(refresh: bool = False):
    """
    Return today's patient list with computed NEWS scores.
    Sorted by NEWS score descending (highest risk first).
    Optional refresh=true forces an immediate DB query and NEWS recalculation.
    """
    from .scheduler import get_patients_cache, fetch_vitals_from_db, build_patient_list, process_vitals

    if refresh:
        await process_vitals()

    # If cache is empty (e.g., first request before scheduler ran), fetch immediately
    cache = get_patients_cache()
    if not cache:
        rows = await fetch_vitals_from_db()
        cache = build_patient_list(rows)

    # Sort by NEWS score descending
    sorted_patients = sorted(cache, key=lambda p: p.get("news_result", {}).get("totalScore", 0), reverse=True)

    # Attach centralized treatment_status from MySQL
    from .treatment_service import get_all_treatment_statuses
    treatment_statuses = await get_all_treatment_statuses()
    for p in sorted_patients:
        hn = str(p.get("hn", ""))
        p["treatment_status"] = treatment_statuses.get(hn)

    return JSONResponse(content={"patients": sorted_patients, "count": len(sorted_patients)})


@app.get("/api/patients/{hn}")
async def get_patient(hn: str):
    """Return a single patient by HN."""
    from .scheduler import get_patients_cache
    from .treatment_service import get_treatment_status

    cache = get_patients_cache()
    patient = next((p for p in cache if p.get("hn") == hn), None)
    if patient is None:
        return JSONResponse(status_code=404, content={"detail": f"Patient HN={hn} not found"})

    patient_copy = dict(patient)
    patient_copy["treatment_status"] = await get_treatment_status(hn)
    return JSONResponse(content=patient_copy)


# ---------------------------------------------------------------------------
# Daily Treated Patients Dashboard Endpoints (PDPA Compliant)
# ---------------------------------------------------------------------------

@app.get("/api/dashboard/daily-stats")
async def get_dashboard_daily_stats_route():
    """Return daily summary stats (total, high risk, treated, ruled out, compliance rate)."""
    from .dashboard_service import get_daily_dashboard_stats
    stats = await get_daily_dashboard_stats()
    return JSONResponse(content=stats)


@app.get("/api/dashboard/daily-cases")
@app.get("/api/dashboard/treated-cases")
async def get_dashboard_daily_cases_route(date: Optional[str] = None):
    """
    Return cases for the given date (strictly PDPA masked: 4-digit HN, age, gender, NEWS).
    Excludes full names, citizen IDs, and addresses.
    Supports both /api/dashboard/daily-cases and /api/dashboard/treated-cases.
    """
    from .dashboard_service import get_daily_treated_cases
    cases = await get_daily_treated_cases(target_date=date)
    return JSONResponse(content={"date": date, "cases": cases, "count": len(cases)})


# ---------------------------------------------------------------------------
# Centralized Patient Treatment & Alert Sync Endpoints
# ---------------------------------------------------------------------------

class AcknowledgeRequest(BaseModel):
    hn: str
    acknowledged_by: Optional[str] = "Nurse/System"
    vn: Optional[str] = None

class CompleteRequest(BaseModel):
    hn: str
    completed_by: Optional[str] = "Nurse/System"

class RuleOutRequest(BaseModel):
    hn: str
    reason: Optional[str] = None

class ChecklistRequest(BaseModel):
    hn: str
    checklist_json: str

@app.get("/api/treatment-status")
async def get_all_treatment_status_route():
    from .treatment_service import get_all_treatment_statuses
    return JSONResponse(content=await get_all_treatment_statuses())

@app.get("/api/treatment-status/{hn}")
async def get_treatment_status_route(hn: str):
    from .treatment_service import get_treatment_status
    st = await get_treatment_status(hn)
    if not st:
        return JSONResponse(status_code=404, content={"detail": f"Status for HN {hn} not found"})
    return JSONResponse(content=st)

@app.post("/api/treatment-status/acknowledge")
async def acknowledge_route(body: AcknowledgeRequest):
    from .treatment_service import acknowledge_alert
    status = await acknowledge_alert(body.hn, body.acknowledged_by or "Nurse/System", body.vn)
    # Broadcast to all open browsers/tabs in real time!
    await broadcast_message(json.dumps({
        "type": "TREATMENT_STATUS_UPDATE",
        "action": "acknowledge",
        "data": status
    }))
    return JSONResponse(content={"status": "acknowledged", "data": status})

@app.post("/api/treatment-status/complete")
async def complete_route(body: CompleteRequest):
    from .treatment_service import complete_treatment
    status = await complete_treatment(body.hn, body.completed_by or "Nurse/System")
    # Broadcast to all open browsers/tabs in real time!
    await broadcast_message(json.dumps({
        "type": "TREATMENT_STATUS_UPDATE",
        "action": "complete",
        "data": status
    }))
    return JSONResponse(content={"status": "completed", "data": status})

@app.post("/api/treatment-status/rule-out")
async def rule_out_route(body: RuleOutRequest):
    from .treatment_service import rule_out_sepsis
    status = await rule_out_sepsis(body.hn)
    # Broadcast to all open browsers/tabs in real time!
    await broadcast_message(json.dumps({
        "type": "TREATMENT_STATUS_UPDATE",
        "action": "rule_out",
        "data": status
    }))
    return JSONResponse(content={"status": "ruled_out", "data": status})

@app.post("/api/treatment-status/checklist")
async def checklist_route(body: ChecklistRequest):
    from .treatment_service import update_checklist_json
    status = await update_checklist_json(body.hn, body.checklist_json)
    # Broadcast to all open browsers/tabs in real time!
    await broadcast_message(json.dumps({
        "type": "TREATMENT_STATUS_UPDATE",
        "action": "checklist",
        "data": status
    }))
    return JSONResponse(content={"status": "saved", "data": status})


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

