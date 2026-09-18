import asyncio
import json
import logging
import time
from datetime import datetime
from contextlib import asynccontextmanager
from typing import List, Any, Dict, Optional
from pydantic import BaseModel

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import db_pool, dashboard_pool
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

    # Startup: connect HOSxP pool (read-only patient data)
    await db_pool.connect()
    logger.info("HOSxP Database connected (sepsis_db — read-only).")

    # Startup: connect Dashboard pool (treatment status & archive)
    await dashboard_pool.connect()
    logger.info("Dashboard Database connected (rtsas_dashboard — read/write).")

    # Ensure treatment tables exist in rtsas_dashboard
    try:
        from .treatment_service import init_treatment_table
        await init_treatment_table()
    except Exception as e:
        logger.error(f"Error initializing treatment table: {e}")

    logger.info("Starting background scheduler...")

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
    await dashboard_pool.disconnect()
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
    """Check HOSxP DB physical connectivity and pool status."""
    status = "connected" if db_pool.pool is not None else "disconnected"
    pool_available = db_pool.pool is not None
    latency_ms = None
    try:
        if db_pool.pool:
            t0 = time.time()
            async with db_pool.get_connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute("SELECT 1")
                    await cur.fetchone()
            latency_ms = round((time.time() - t0) * 1000, 2)
            status = "connected"
        else:
            status = "disconnected"
    except Exception as e:
        status = f"error: {str(e)[:80]}"
        pool_available = False

    return {
        "status": status,
        "pool_available": pool_available,
        "latency_ms": latency_ms,
        "host": settings.DB_HOST,
        "port": settings.DB_PORT,
        "database": settings.DB_NAME,
        "pool_size": getattr(db_pool.pool, 'size', 0) if db_pool.pool else 0,
        "pool_free": getattr(db_pool.pool, 'freesize', 0) if db_pool.pool else 0,
    }


@app.post("/api/admin/disconnect-db")
@app.post("/api/admin/simulate-disconnect")
async def disconnect_db_route():
    """Physically disconnect the MySQL database connection pool to test system resilience and live logs."""
    from .log_service import record_log
    try:
        await db_pool.disconnect()
        record_log(
            "ERROR",
            f"CRITICAL: Physical connection to HOSxP MySQL database closed ({settings.DB_HOST}:{settings.DB_PORT}). Pool terminated.",
            component="HOSxP_DB",
            details={"host": settings.DB_HOST, "port": settings.DB_PORT, "status": "DISCONNECTED", "impact": "Central DB unreachable"}
        )
        record_log(
            "Warning",
            "Failover Buffer Activated: Database connection is offline. System operating on offline cache buffer.",
            component="Failover_Buffer",
            details={"mode": "OFFLINE_CACHE", "protection": "ACTIVE", "buffered_at": datetime.now().isoformat()}
        )
        return {"status": "disconnected", "pool_available": False, "message": "Database physically disconnected"}
    except Exception as e:
        logger.error(f"Error disconnecting DB: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/api/admin/reconnect-db")
@app.post("/api/admin/simulate-reconnect")
async def reconnect_db_route():
    """Physically re-establish MySQL database connection pool."""
    from .log_service import record_log
    try:
        await db_pool.connect()
        async with db_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT 1")
                await cur.fetchone()

        record_log(
            "Note",
            f"SUCCESS: Physical connection to HOSxP MySQL database restored ({settings.DB_HOST}:{settings.DB_PORT}). Connection pool ready.",
            component="HOSxP_DB",
            details={"host": settings.DB_HOST, "port": settings.DB_PORT, "status": "CONNECTED"}
        )
        record_log(
            "Note",
            "Failover Buffer Synchronized: Central database re-connected. Normal operation resumed.",
            component="Failover_Buffer",
            details={"sync_status": "COMPLETED", "recovered_at": datetime.now().isoformat()}
        )
        return {"status": "connected", "pool_available": True, "message": "Database connected successfully"}
    except Exception as e:
        logger.error(f"Error reconnecting DB: {e}")
        record_log(
            "ERROR",
            f"Failed to reconnect to MySQL database: {str(e)}",
            component="HOSxP_DB",
            details={"error": str(e)}
        )
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})


@app.post("/api/system/logs/clear")
@app.delete("/api/system/logs")
async def clear_logs_route():
    """Clear all system logs."""
    from .log_service import clear_logs, record_log
    cleared = clear_logs()
    record_log(
        "Note",
        f"Admin Action: Cleared {cleared} diagnostic log entries.",
        component="System_Logs",
        details={"cleared_count": cleared, "cleared_at": datetime.now().isoformat()}
    )
    return {"success": True, "cleared_count": cleared}



# ---------------------------------------------------------------------------
# Simulator & Reset Testing Endpoints
# ---------------------------------------------------------------------------

class InjectPatientRequest(BaseModel):
    hn: str
    patient_name: Optional[str] = None
    sex: Optional[str] = "male"
    age: Optional[int] = 55
    chief_complaint: Optional[str] = "มีไข้สูง หนาวสั่น หายใจหอบเหนื่อย"
    sbp: Optional[int] = 85
    dbp: Optional[int] = 50
    heart_rate: Optional[int] = 120
    resp_rate: Optional[int] = 26
    temperature: Optional[float] = 39.0
    spo2: Optional[int] = 92
    gcs: Optional[int] = 14
    vstdate: Optional[str] = None
    vsttime: Optional[str] = None


@app.post("/api/admin/insert-patient")
@app.post("/api/simulator/inject-patient")
async def inject_patient_route(payload: InjectPatientRequest):
    """Insert patient data into MySQL database, update cache, and broadcast alert live via WebSocket."""
    from .scheduler import inject_simulated_patient
    from .log_service import record_log
    try:
        data = payload.model_dump()
        patient_item = await inject_simulated_patient(data)
        record_log(
            "Note",
            f"Admin Patient Entry: Inserted patient HN {payload.hn} into MySQL database (NEWS {patient_item.get('news_result', {}).get('totalScore', 0)})",
            component="Admin_DB_Insert",
            details={"hn": payload.hn, "news": patient_item.get("news_result", {}).get("totalScore", 0)}
        )
        return {"success": True, "patient": patient_item}
    except Exception as e:
        logger.error(f"Failed to inject simulated patient: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/reset-dashboard")
async def admin_reset_dashboard():
    """Clear all treated statuses and reset dashboard to clean zero-state for testing or production."""
    from .treatment_service import clear_treated_statuses
    from .scheduler import clear_cache
    from .log_service import record_log
    try:
        cleared_hns = await clear_treated_statuses()
        clear_cache()
        await broadcast_message(json.dumps({
            "type": "TREATMENT_STATUS_UPDATE",
            "action": "clear_treated",
            "cleared_hns": cleared_hns,
        }))
        record_log(
            "Note",
            f"Admin Reset: Cleared {len(cleared_hns)} treated records. Dashboard reset to zero-state.",
            component="Admin_Dashboard",
            details={"cleared_hns": cleared_hns}
        )
        return {"success": True, "cleared_count": len(cleared_hns), "cleared_hns": cleared_hns}
    except Exception as e:
        logger.error(f"Failed to reset dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Timestamp Logs Endpoint (Database & Service Website Diagnostics)
# ---------------------------------------------------------------------------

@app.get("/api/logs")
@app.get("/api/system/logs")
async def get_logs_route(limit: int = 50, level: Optional[str] = None, search: Optional[str] = None):
    """Return database and service timestamp logs."""
    from .log_service import get_logs, get_log_summary
    logs = get_logs(limit=limit, level=level, search=search)
    summary = get_log_summary()
    return JSONResponse(content={"logs": logs, "count": len(logs), "summary": summary})


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
    """Return a single patient by HN. Checks memory cache first, then falls back to database or archive for historical visits."""
    from .scheduler import get_patients_cache, build_patient_list
    from .treatment_service import get_treatment_status
    import aiomysql

    cache = get_patients_cache()
    patient = next((p for p in cache if p.get("hn") == hn), None)
    archive_t_status = None

    if patient is None:
        try:
            async with db_pool.get_connection() as conn:
                cur = await conn.cursor(aiomysql.DictCursor)
                await cur.execute(
                    "SELECT id, vstdate, vsttime, hn, vn, NULL AS patient_name, sex, age, chief_complaint, "
                    "gcs, spo2, heart_rate, sbp, dbp, resp_rate, temperature, weight, height, created_at "
                    "FROM patient_visits WHERE hn = %s ORDER BY vstdate DESC, vsttime DESC LIMIT 1",
                    (hn,)
                )
                row = await cur.fetchone()
                if row:
                    built = build_patient_list([row])
                    if built:
                        patient = built[0]
        except Exception as e:
            logger.error(f"Error fetching historical patient {hn} from patient_visits: {e}")

    # Fallback 2: Check treated_patient_archive in dashboard_pool
    if patient is None:
        try:
            async with dashboard_pool.get_connection() as conn:
                cur = await conn.cursor(aiomysql.DictCursor)
                await cur.execute(
                    "SELECT hn, vn, sex, age, chief_complaint, sbp, dbp, heart_rate, resp_rate, "
                    "temperature, spo2, gcs, weight, height, news_score, risk_level, has_single_alert, "
                    "arrival_date AS vstdate, arrival_time AS vsttime, acknowledged_at, acknowledged_by, "
                    "doctor_confirmed, countdown_started_at, countdown_duration, treatment_completed, "
                    "treatment_completed_at, treatment_completed_by, sepsis_ruled_out, checklist_json, "
                    "timeline_json, outcome_label, archived_at "
                    "FROM treated_patient_archive WHERE hn = %s ORDER BY id DESC LIMIT 1",
                    (hn,)
                )
                arch_row = await cur.fetchone()
                if arch_row:
                    built = build_patient_list([arch_row])
                    if built:
                        patient = built[0]
                        archive_t_status = {
                            "hn": hn,
                            "vn": arch_row.get("vn"),
                            "acknowledged": bool(arch_row.get("acknowledged_at")),
                            "acknowledged_at": arch_row["acknowledged_at"].isoformat() if arch_row.get("acknowledged_at") else None,
                            "acknowledged_by": arch_row.get("acknowledged_by"),
                            "doctor_confirmed": bool(arch_row.get("doctor_confirmed")),
                            "countdown_started_at": arch_row["countdown_started_at"].isoformat() if arch_row.get("countdown_started_at") else None,
                            "countdown_duration": arch_row.get("countdown_duration") or 3600,
                            "treatment_completed": bool(arch_row.get("treatment_completed")),
                            "treatment_completed_at": arch_row["treatment_completed_at"].isoformat() if arch_row.get("treatment_completed_at") else None,
                            "treatment_completed_by": arch_row.get("treatment_completed_by"),
                            "sepsis_ruled_out": bool(arch_row.get("sepsis_ruled_out")),
                            "checklist_json": arch_row.get("checklist_json"),
                            "updated_at": arch_row["archived_at"].isoformat() if arch_row.get("archived_at") else None,
                        }
        except Exception as e:
            logger.error(f"Error fetching archived patient {hn} from dashboard DB: {e}")

    # Fallback 3: Check opdscreen in db_pool
    if patient is None:
        try:
            async with db_pool.get_connection() as conn:
                cur = await conn.cursor(aiomysql.DictCursor)
                await cur.execute(
                    "SELECT o.hn, o.vn, o.vstdate, o.vsttime, "
                    "o.bpd AS dbp, o.bps AS sbp, o.pulse AS heart_rate, o.rr AS resp_rate, "
                    "o.temperature, o.spo2, o.cc AS chief_complaint, "
                    "o.bw AS weight, o.height AS height, "
                    "(e.gcs_e + e.gcs_v + e.gcs_m) AS gcs "
                    "FROM opdscreen o "
                    "LEFT JOIN er_nursing_detail e ON e.vn = o.vn "
                    "WHERE o.hn = %s ORDER BY o.vstdate DESC, o.vsttime DESC LIMIT 1",
                    (hn,)
                )
                opd_row = await cur.fetchone()
                if opd_row:
                    built = build_patient_list([opd_row])
                    if built:
                        patient = built[0]
        except Exception as e:
            logger.error(f"Error fetching opdscreen patient {hn} from DB: {e}")

    if patient is None:
        return JSONResponse(status_code=404, content={"detail": f"Patient HN={hn} not found"})

    patient_copy = dict(patient)
    current_status = await get_treatment_status(hn)
    if (not current_status or (not current_status.get("treatment_completed") and not current_status.get("sepsis_ruled_out"))) and archive_t_status:
        patient_copy["treatment_status"] = archive_t_status
    else:
        patient_copy["treatment_status"] = current_status
    return JSONResponse(content=patient_copy)


@app.get("/api/patients/{hn}/timeline")
async def get_patient_timeline_route(hn: str):
    """Return clinical timeline events and treatment status for a patient."""
    import aiomysql
    from .treatment_service import get_treatment_status
    from .services import format_time_str

    t_status = await get_treatment_status(hn)

    visit = None
    try:
        async with db_pool.get_connection() as conn:
            cur = await conn.cursor(aiomysql.DictCursor)
            await cur.execute(
                "SELECT vstdate, vsttime, chief_complaint, sbp, dbp, heart_rate, resp_rate, temperature, spo2 "
                "FROM patient_visits WHERE hn = %s ORDER BY vstdate DESC, vsttime DESC LIMIT 1",
                (hn,)
            )
            visit = await cur.fetchone()
    except Exception as e:
        logger.error(f"Error fetching visit for timeline {hn}: {e}")

    # Fallback to treated_patient_archive if visit not in patient_visits
    if visit is None:
        try:
            async with dashboard_pool.get_connection() as conn:
                cur = await conn.cursor(aiomysql.DictCursor)
                await cur.execute(
                    "SELECT arrival_date AS vstdate, arrival_time AS vsttime, chief_complaint, "
                    "sbp, dbp, heart_rate, resp_rate, temperature, spo2, "
                    "acknowledged_at, acknowledged_by, doctor_confirmed, countdown_started_at, countdown_duration, "
                    "treatment_completed, treatment_completed_at, treatment_completed_by, sepsis_ruled_out, "
                    "checklist_json, timeline_json, archived_at "
                    "FROM treated_patient_archive WHERE hn = %s ORDER BY id DESC LIMIT 1",
                    (hn,)
                )
                visit = await cur.fetchone()
                if visit and (not t_status or (not t_status.get("treatment_completed") and not t_status.get("sepsis_ruled_out"))):
                    t_status = {
                        "hn": hn,
                        "acknowledged": bool(visit.get("acknowledged_at")),
                        "acknowledged_at": visit["acknowledged_at"].isoformat() if visit.get("acknowledged_at") else None,
                        "acknowledged_by": visit.get("acknowledged_by"),
                        "doctor_confirmed": bool(visit.get("doctor_confirmed")),
                        "countdown_started_at": visit["countdown_started_at"].isoformat() if visit.get("countdown_started_at") else None,
                        "countdown_duration": visit.get("countdown_duration") or 3600,
                        "treatment_completed": bool(visit.get("treatment_completed")),
                        "treatment_completed_at": visit["treatment_completed_at"].isoformat() if visit.get("treatment_completed_at") else None,
                        "treatment_completed_by": visit.get("treatment_completed_by"),
                        "sepsis_ruled_out": bool(visit.get("sepsis_ruled_out")),
                        "checklist_json": visit.get("checklist_json"),
                        "updated_at": visit["archived_at"].isoformat() if visit.get("archived_at") else None,
                    }
        except Exception as e:
            logger.error(f"Error fetching archived visit for timeline {hn}: {e}")

    events = []
    arrival_iso = datetime.now().isoformat()
    if visit:
        vstdate = str(visit.get("vstdate", ""))
        vsttime = format_time_str(visit.get("vsttime"))[:5] if visit.get("vsttime") else "08:00"
        arrival_iso = f"{vstdate}T{vsttime}:00"
        events.append({
            "id": f"visit_{hn}",
            "timestamp": arrival_iso,
            "actionText": f"🏥 ผู้ป่วยมาถึง ER เวลา {vsttime} น.",
            "color": "blue",
            "actor": "ระบบ",
        })

        # Calculate NEWS score from visit vitals
        from .services import calculate_news_from_row
        news_res = calculate_news_from_row(visit)
        news_score = news_res.totalScore
        events.append({
            "id": f"news_{hn}",
            "timestamp": arrival_iso,
            "actionText": f"🧮 ระบบคำนวณ NEWS Score = {news_score} ",
            "color": "red" if news_score >= 5 else "orange" if news_score >= 1 else "green",
            "actor": "ระบบ RTSAS",
        })

    if t_status:
        if t_status.get("acknowledged") and t_status.get("acknowledged_at"):
            events.append({
                "id": f"ack_{hn}",
                "timestamp": t_status["acknowledged_at"],
                "actionText": "🔔 พยาบาลรับทราบการแจ้งเตือนสัญญาณชีพวิกฤต (Acknowledge Alert)",
                "color": "blue",
                "actor": t_status.get("acknowledged_by") or "พยาบาล ER",
            })
        if t_status.get("doctor_confirmed") and t_status.get("countdown_started_at"):
            events.append({
                "id": f"doc_{hn}",
                "timestamp": t_status["countdown_started_at"],
                "actionText": "👨‍⚕️ แพทย์เวรยืนยันภาวะสงสัย Sepsis — เริ่มนับเวลา 60 นาที (1-Hour Sepsis Bundle)",
                "color": "blue",
                "actor": "แพทย์เวร ER",
            })
        if t_status.get("checklist_json"):
            try:
                cl = json.loads(t_status["checklist_json"])
                for phase in cl:
                    for item in phase.get("items", []):
                        if item.get("status") == "completed" and item.get("id") != "doctor_confirm":
                            events.append({
                                "id": f"item_{item.get('id')}_{hn}",
                                "timestamp": item.get("completedAt") or t_status.get("countdown_started_at") or arrival_iso,
                                "actionText": f"✓ {item.get('label', '')}" + (f" — {item.get('inputValue')}" if item.get("inputValue") else ""),
                                "color": "blue",
                                "actor": item.get("completedBy") or "พยาบาล ER",
                            })
            except Exception as e:
                logger.warning(f"Error parsing checklist_json for timeline: {e}")
        if t_status.get("treatment_completed"):
            events.append({
                "id": f"comp_{hn}",
                "timestamp": t_status.get("treatment_completed_at") or arrival_iso,
                "actionText": "✅ สิ้นสุดกระบวนการรักษา (Complete 1-Hour Sepsis Bundle ครบถ้วนตามมาตรฐาน)",
                "color": "green",
                "actor": t_status.get("treatment_completed_by") or "ทีมแพทย์/พยาบาล ER",
            })
        elif t_status.get("sepsis_ruled_out"):
            events.append({
                "id": f"ro_{hn}",
                "timestamp": t_status.get("updated_at") or arrival_iso,
                "actionText": "🟢 แพทย์ตรวจวินิจฉัยซ้ำ ไม่ใช่ภาวะติดเชื้อ Sepsis (Rule Out Sepsis)",
                "color": "green",
                "actor": "แพทย์เวร ER",
            })

    return JSONResponse(content={"hn": hn, "events": events, "treatment_status": t_status})


# ---------------------------------------------------------------------------
# Daily Treated Patients Dashboard Endpoints (PDPA Compliant)
# ---------------------------------------------------------------------------

@app.get("/api/dashboard/daily-stats")
async def get_dashboard_daily_stats_route():
    """Return daily summary stats from archive table (total, high risk, treated, ruled out, compliance rate)."""
    from .treatment_service import get_archived_stats
    stats = await get_archived_stats()
    return JSONResponse(content=stats)


@app.get("/api/dashboard/daily-cases")
async def get_dashboard_daily_cases_route(date: Optional[str] = None):
    """Return all archived patient cases on target_date for general overview."""
    from .treatment_service import get_archived_cases
    cases = await get_archived_cases(target_date=date, treated_only=False)
    return JSONResponse(content={"date": date, "cases": cases, "count": len(cases)})


@app.get("/api/dashboard/treated-cases")
async def get_dashboard_treated_cases_route(date: Optional[str] = None, treated_only: bool = True):
    """Return only treated/completed/ruled-out cases from archive for Treated Cases Dashboard."""
    from .treatment_service import get_archived_cases
    cases = await get_archived_cases(target_date=date, treated_only=treated_only)
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

class DoctorConfirmRequest(BaseModel):
    hn: str
    confirmed_by: Optional[str] = "Doctor"
    physician: Optional[str] = None
    confirmed_at: Optional[str] = None

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

@app.post("/api/treatment-status/doctor-confirm")
async def doctor_confirm_route(body: DoctorConfirmRequest):
    from .treatment_service import doctor_confirm_sepsis
    status = await doctor_confirm_sepsis(body.hn, body.confirmed_by or "Doctor", body.physician, body.confirmed_at)
    # Broadcast to all open browsers/tabs in real time!
    await broadcast_message(json.dumps({
        "type": "TREATMENT_STATUS_UPDATE",
        "action": "doctor_confirm",
        "data": status
    }))
    return JSONResponse(content={"status": "confirmed", "data": status})

@app.post("/api/treatment-status/complete")
async def complete_route(body: CompleteRequest):
    from .treatment_service import complete_treatment
    status = await complete_treatment(body.hn, body.completed_by or "Nurse/System")
    # Broadcast completion + archive to all open browsers/tabs in real time!
    await broadcast_message(json.dumps({
        "type": "TREATMENT_STATUS_UPDATE",
        "action": "complete",
        "data": status
    }))
    # Broadcast archived event so frontend removes patient from active list
    await broadcast_message(json.dumps({
        "type": "TREATMENT_STATUS_UPDATE",
        "action": "archived",
        "hn": body.hn,
        "data": status
    }))
    return JSONResponse(content={"status": "completed", "data": status})

@app.post("/api/treatment-status/rule-out")
async def rule_out_route(body: RuleOutRequest):
    from .treatment_service import rule_out_sepsis
    status = await rule_out_sepsis(body.hn)
    # Broadcast rule-out + archive to all open browsers/tabs in real time!
    await broadcast_message(json.dumps({
        "type": "TREATMENT_STATUS_UPDATE",
        "action": "rule_out",
        "data": status
    }))
    # Broadcast archived event so frontend removes patient from active list
    await broadcast_message(json.dumps({
        "type": "TREATMENT_STATUS_UPDATE",
        "action": "archived",
        "hn": body.hn,
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

@app.post("/api/treatment-status/clear-treated")
async def clear_treated_route():
    """Clear all records where treatment was completed, preserving active patients and visits."""
    from .treatment_service import clear_treated_statuses
    cleared_hns = await clear_treated_statuses()
    # Broadcast to all open browser sessions in real time
    await broadcast_message(json.dumps({
        "type": "TREATMENT_STATUS_UPDATE",
        "action": "clear_treated",
        "cleared_hns": cleared_hns
    }))
    return JSONResponse(content={
        "status": "success",
        "message": f"Cleared {len(cleared_hns)} completed treatment record(s).",
        "cleared_hns": cleared_hns
    })


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

