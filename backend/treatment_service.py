import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from aiomysql import DictCursor

from .database import db_pool, dashboard_pool

logger = logging.getLogger(__name__)

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS patient_treatment_status (
    hn VARCHAR(20) PRIMARY KEY,
    vn VARCHAR(20) NULL,
    acknowledged TINYINT(1) DEFAULT 0,
    acknowledged_at DATETIME NULL,
    acknowledged_by VARCHAR(100) NULL,
    doctor_confirmed TINYINT(1) DEFAULT 0,
    countdown_started_at DATETIME NULL,
    countdown_duration INT DEFAULT 3600,
    treatment_completed TINYINT(1) DEFAULT 0,
    treatment_completed_at DATETIME NULL,
    treatment_completed_by VARCHAR(100) NULL,
    sepsis_ruled_out TINYINT(1) DEFAULT 0,
    checklist_json MEDIUMTEXT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""

CREATE_ARCHIVE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS treated_patient_archive (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hn VARCHAR(20) NOT NULL,
    vn VARCHAR(20) NULL,
    sex VARCHAR(10) NULL,
    age INT NULL,
    chief_complaint TEXT NULL,
    sbp FLOAT NULL,
    dbp FLOAT NULL,
    heart_rate FLOAT NULL,
    resp_rate FLOAT NULL,
    temperature FLOAT NULL,
    spo2 FLOAT NULL,
    gcs INT NULL,
    weight FLOAT NULL,
    height FLOAT NULL,
    news_score INT DEFAULT 0,
    risk_level VARCHAR(20) DEFAULT 'low',
    has_single_alert TINYINT(1) DEFAULT 0,
    arrival_date DATE NULL,
    arrival_time TIME NULL,
    acknowledged_at DATETIME NULL,
    acknowledged_by VARCHAR(100) NULL,
    doctor_confirmed TINYINT(1) DEFAULT 0,
    countdown_started_at DATETIME NULL,
    countdown_duration INT DEFAULT 3600,
    treatment_completed TINYINT(1) DEFAULT 0,
    treatment_completed_at DATETIME NULL,
    treatment_completed_by VARCHAR(100) NULL,
    sepsis_ruled_out TINYINT(1) DEFAULT 0,
    checklist_json MEDIUMTEXT NULL,
    timeline_json MEDIUMTEXT NULL,
    outcome_label VARCHAR(100) NULL,
    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_archive_date (arrival_date),
    INDEX idx_archive_hn (hn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""

async def init_treatment_table():
    """Ensure the patient_treatment_status and treated_patient_archive tables exist in rtsas_dashboard."""
    try:
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(CREATE_TABLE_SQL)
                await cur.execute(CREATE_ARCHIVE_TABLE_SQL)
                logger.info("Initialized patient_treatment_status and treated_patient_archive tables in rtsas_dashboard.")
    except Exception as e:
        logger.error(f"Failed to initialize treatment tables: {e}")

def _format_dt(val) -> Optional[str]:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.isoformat()
    return str(val)

def _row_to_status_dict(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "hn": str(row.get("hn", "")),
        "vn": row.get("vn"),
        "acknowledged": bool(row.get("acknowledged", 0)),
        "acknowledged_at": _format_dt(row.get("acknowledged_at")),
        "acknowledged_by": row.get("acknowledged_by"),
        "doctor_confirmed": bool(row.get("doctor_confirmed", 0)),
        "countdown_started_at": _format_dt(row.get("countdown_started_at")),
        "countdown_duration": int(row.get("countdown_duration") or 3600),
        "treatment_completed": bool(row.get("treatment_completed", 0)),
        "treatment_completed_at": _format_dt(row.get("treatment_completed_at")),
        "treatment_completed_by": row.get("treatment_completed_by"),
        "sepsis_ruled_out": bool(row.get("sepsis_ruled_out", 0)),
        "checklist_json": row.get("checklist_json"),
        "updated_at": _format_dt(row.get("updated_at")),
    }

async def get_all_treatment_statuses() -> Dict[str, Dict[str, Any]]:
    """Return all treatment statuses indexed by HN, including archived/ruled-out patients."""
    try:
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor(DictCursor) as cur:
                await cur.execute("SELECT * FROM patient_treatment_status;")
                rows = await cur.fetchall()
                result = {}
                for row in rows:
                    st = _row_to_status_dict(row)
                    result[st["hn"]] = st

                # Also include archived patients from treated_patient_archive (ruled out or completed)
                try:
                    await cur.execute("SELECT * FROM treated_patient_archive;")
                    archive_rows = await cur.fetchall()
                    for a_row in archive_rows:
                        a_hn = str(a_row.get("hn", "")).strip()
                        if a_hn and a_hn not in result:
                            result[a_hn] = {
                                "hn": a_hn,
                                "vn": a_row.get("vn"),
                                "acknowledged": bool(a_row.get("acknowledged_at")),
                                "acknowledged_at": a_row.get("acknowledged_at").isoformat() if a_row.get("acknowledged_at") else None,
                                "acknowledged_by": a_row.get("acknowledged_by"),
                                "doctor_confirmed": bool(a_row.get("doctor_confirmed")),
                                "countdown_started_at": a_row.get("countdown_started_at").isoformat() if a_row.get("countdown_started_at") else None,
                                "countdown_duration": a_row.get("countdown_duration", 3600),
                                "treatment_completed": bool(a_row.get("treatment_completed")),
                                "treatment_completed_at": a_row.get("treatment_completed_at").isoformat() if a_row.get("treatment_completed_at") else None,
                                "treatment_completed_by": a_row.get("treatment_completed_by"),
                                "sepsis_ruled_out": bool(a_row.get("sepsis_ruled_out")),
                                "checklist_json": a_row.get("checklist_json"),
                                "is_archived": True,
                            }
                except Exception as arch_err:
                    logger.warning(f"Error querying treated_patient_archive in get_all_treatment_statuses: {arch_err}")

                return result
    except Exception as e:
        logger.error(f"Error fetching treatment statuses: {e}")
        return {}

async def get_treatment_status(hn: str) -> Optional[Dict[str, Any]]:
    """Return treatment status for a specific HN, checking active and archived."""
    try:
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor(DictCursor) as cur:
                await cur.execute("SELECT * FROM patient_treatment_status WHERE hn = %s LIMIT 1;", (hn,))
                row = await cur.fetchone()
                if row:
                    return _row_to_status_dict(row)
                # Fallback to treated_patient_archive if archived
                try:
                    await cur.execute("SELECT * FROM treated_patient_archive WHERE hn = %s ORDER BY id DESC LIMIT 1;", (hn,))
                    a_row = await cur.fetchone()
                    if a_row:
                        return {
                            "hn": hn,
                            "vn": a_row.get("vn"),
                            "acknowledged": bool(a_row.get("acknowledged_at")),
                            "acknowledged_at": a_row.get("acknowledged_at").isoformat() if a_row.get("acknowledged_at") else None,
                            "acknowledged_by": a_row.get("acknowledged_by"),
                            "doctor_confirmed": bool(a_row.get("doctor_confirmed")),
                            "countdown_started_at": a_row.get("countdown_started_at").isoformat() if a_row.get("countdown_started_at") else None,
                            "countdown_duration": a_row.get("countdown_duration", 3600),
                            "treatment_completed": bool(a_row.get("treatment_completed")),
                            "treatment_completed_at": a_row.get("treatment_completed_at").isoformat() if a_row.get("treatment_completed_at") else None,
                            "treatment_completed_by": a_row.get("treatment_completed_by"),
                            "sepsis_ruled_out": bool(a_row.get("sepsis_ruled_out")),
                            "checklist_json": a_row.get("checklist_json"),
                            "is_archived": True,
                        }
                except Exception:
                    pass
                return None
    except Exception as e:
        logger.error(f"Error fetching treatment status for HN {hn}: {e}")
        return None

async def acknowledge_alert(hn: str, acknowledged_by: str = "Nurse/System", vn: Optional[str] = None) -> Dict[str, Any]:
    """
    Mark a patient's alert as acknowledged and start the 1-hour bundle countdown.
    Upserts into patient_treatment_status.
    """
    now = datetime.now()
    now_str = now.strftime('%Y-%m-%d %H:%M:%S')

    query = """
    INSERT INTO patient_treatment_status (
        hn, vn, acknowledged, acknowledged_at, acknowledged_by,
        doctor_confirmed, countdown_started_at, countdown_duration
    ) VALUES (%s, %s, 1, %s, %s, 1, %s, 3600)
    ON DUPLICATE KEY UPDATE
        acknowledged = 1,
        acknowledged_at = COALESCE(acknowledged_at, VALUES(acknowledged_at)),
        acknowledged_by = COALESCE(acknowledged_by, VALUES(acknowledged_by)),
        doctor_confirmed = 1,
        countdown_started_at = COALESCE(countdown_started_at, VALUES(countdown_started_at)),
        updated_at = NOW();
    """
    try:
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, (hn, vn, now_str, acknowledged_by, now_str))
        logger.info(f"Acknowledged alert centrally for HN {hn} by {acknowledged_by}")
        status = await get_treatment_status(hn)
        return status or {
            "hn": hn,
            "acknowledged": True,
            "acknowledged_at": now.isoformat(),
            "acknowledged_by": acknowledged_by,
            "doctor_confirmed": True,
            "countdown_started_at": now.isoformat(),
            "countdown_duration": 3600,
            "treatment_completed": False,
            "sepsis_ruled_out": False,
        }
    except Exception as e:
        logger.error(f"Failed to acknowledge alert for HN {hn}: {e}")
        raise e

async def doctor_confirm_sepsis(
    hn: str,
    confirmed_by: str = "Doctor/Nurse",
    physician: Optional[str] = None,
    confirmed_at: Optional[str] = None
) -> Dict[str, Any]:
    """
    Mark doctor confirmation for clinical sepsis with the clinical confirmed_at time as countdown start.
    """
    if confirmed_at:
        try:
            # Parse ISO string or datetime
            c_dt = datetime.fromisoformat(confirmed_at.replace('Z', '+00:00'))
            if c_dt.tzinfo is not None:
                # Convert UTC / offset-aware datetime to local system time to match MySQL DATETIME
                c_dt = c_dt.astimezone()
            start_str = c_dt.strftime('%Y-%m-%d %H:%M:%S')
        except Exception:
            start_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    else:
        start_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    query = """
    INSERT INTO patient_treatment_status (
        hn, acknowledged, acknowledged_at, acknowledged_by,
        doctor_confirmed, countdown_started_at, countdown_duration
    ) VALUES (%s, 1, %s, %s, 1, %s, 3600)
    ON DUPLICATE KEY UPDATE
        acknowledged = 1,
        doctor_confirmed = 1,
        countdown_started_at = VALUES(countdown_started_at),
        acknowledged_by = COALESCE(acknowledged_by, VALUES(acknowledged_by)),
        updated_at = NOW();
    """
    try:
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, (hn, start_str, confirmed_by, start_str))
        logger.info(f"Doctor confirmed sepsis centrally for HN {hn} by {confirmed_by} (physician: {physician}, started_at: {start_str})")
        status = await get_treatment_status(hn)
        return status or {
            "hn": hn,
            "acknowledged": True,
            "acknowledged_at": start_str,
            "acknowledged_by": confirmed_by,
            "doctor_confirmed": True,
            "countdown_started_at": start_str,
            "countdown_duration": 3600,
            "treatment_completed": False,
            "sepsis_ruled_out": False,
        }
    except Exception as e:
        logger.error(f"Failed to record doctor confirm for HN {hn}: {e}")
        raise e


async def complete_treatment(hn: str, completed_by: str = "Nurse/System", timeline_json: Optional[str] = None) -> Dict[str, Any]:
    """Mark a patient's treatment as completed, then archive to separate table."""
    now = datetime.now()
    now_str = now.strftime('%Y-%m-%d %H:%M:%S')

    query = """
    INSERT INTO patient_treatment_status (
        hn, treatment_completed, treatment_completed_at, treatment_completed_by
    ) VALUES (%s, 1, %s, %s)
    ON DUPLICATE KEY UPDATE
        treatment_completed = 1,
        treatment_completed_at = VALUES(treatment_completed_at),
        treatment_completed_by = VALUES(treatment_completed_by),
        updated_at = NOW();
    """
    try:
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, (hn, now_str, completed_by))
        logger.info(f"Marked treatment completed centrally for HN {hn} by {completed_by}")
        status = await get_treatment_status(hn)

        # Record Stage 1: Clinical treatment completed
        try:
            from .log_service import record_log
            hn_clean = str(hn)[2:].strip() if str(hn).upper().startswith("HN") else str(hn).strip()
            hn_display = f"HN {hn_clean}"
            record_log(
                "Note",
                f"บันทึกสิ้นสุดการรักษา (Complete 1-Hour Sepsis Bundle): ผู้ป่วย {hn_display} โดย {completed_by}",
                component="Clinical_Treatment",
                details={
                    "hn": hn,
                    "completed_by": completed_by,
                    "completed_at": now_str,
                }
            )
        except Exception as log_err:
            logger.error(f"Failed to record complete treatment log: {log_err}")

        # Auto-archive: move to treated_patient_archive and remove from active tables
        try:
            await archive_treated_patient(hn, outcome_label="✅ Sepsis Bundle สำเร็จ", timeline_json=timeline_json)
        except Exception as archive_err:
            logger.error(f"Failed to archive treated patient HN {hn}: {archive_err}")

        return status or {
            "hn": hn,
            "treatment_completed": True,
            "treatment_completed_at": now.isoformat(),
            "treatment_completed_by": completed_by,
        }
    except Exception as e:
        logger.error(f"Failed to complete treatment for HN {hn}: {e}")
        raise e

async def rule_out_sepsis(hn: str) -> Dict[str, Any]:
    """Mark sepsis as ruled out for a patient, then archive to separate table."""
    query = """
    INSERT INTO patient_treatment_status (hn, sepsis_ruled_out, doctor_confirmed, countdown_started_at)
    VALUES (%s, 1, 0, NULL)
    ON DUPLICATE KEY UPDATE
        sepsis_ruled_out = 1,
        doctor_confirmed = 0,
        countdown_started_at = NULL,
        updated_at = NOW();
    """
    try:
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, (hn,))
        logger.info(f"Marked sepsis ruled out centrally for HN {hn}")
        status = await get_treatment_status(hn)

        # Record Stage 1: Sepsis ruled out
        try:
            from .log_service import record_log
            hn_clean = str(hn)[2:].strip() if str(hn).upper().startswith("HN") else str(hn).strip()
            hn_display = f"HN {hn_clean}"
            record_log(
                "Note",
                f"บันทึกผลการตรวจซ้ำไม่พบ Sepsis (Rule Out): ผู้ป่วย {hn_display}",
                component="Clinical_Treatment",
                details={
                    "hn": hn,
                    "ruled_out_at": datetime.now().isoformat(),
                }
            )
        except Exception as log_err:
            logger.error(f"Failed to record rule out sepsis log: {log_err}")

        # Auto-archive: move to treated_patient_archive and remove from active tables
        try:
            await archive_treated_patient(hn, outcome_label="🟢 Rule Out Sepsis")
        except Exception as archive_err:
            logger.error(f"Failed to archive ruled-out patient HN {hn}: {archive_err}")

        return status or {"hn": hn, "sepsis_ruled_out": True}
    except Exception as e:
        logger.error(f"Failed to rule out sepsis for HN {hn}: {e}")
        raise e

async def update_checklist_json(hn: str, checklist_json: str) -> Dict[str, Any]:
    """Save the serialized checklist JSON for a patient."""
    query = """
    INSERT INTO patient_treatment_status (hn, checklist_json)
    VALUES (%s, %s)
    ON DUPLICATE KEY UPDATE
        checklist_json = VALUES(checklist_json),
        updated_at = NOW();
    """
    try:
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, (hn, checklist_json))
        status = await get_treatment_status(hn)
        return status or {"hn": hn, "checklist_json": checklist_json}
    except Exception as e:
        logger.error(f"Failed to update checklist for HN {hn}: {e}")
        raise e

async def archive_treated_patient(hn: str, outcome_label: str = "", timeline_json: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Copy patient visit data + treatment status into treated_patient_archive (rtsas_dashboard),
    then remove the patient from patient_treatment_status (rtsas_dashboard).
    NOTE: patient_visits in sepsis_db is read-only (HOSxP) — we only READ from it, never delete.
    """
    from .services import calculate_news_from_row, format_time_str

    try:
        # 1. Fetch patient visit data from sepsis_db (read-only HOSxP)
        visit = None
        async with db_pool.get_connection() as conn:
            async with conn.cursor(DictCursor) as cur:
                await cur.execute(
                    "SELECT vn, hn, vstdate, vsttime, sex, age, heart_rate, sbp, dbp, "
                    "resp_rate, temperature, spo2, gcs, weight, height, chief_complaint "
                    "FROM patient_visits WHERE hn = %s LIMIT 1;",
                    (hn,)
                )
                visit = await cur.fetchone()

        if not visit:
            logger.warning(f"Cannot archive HN {hn}: no visit record found in sepsis_db")
            return None

        # 2. Fetch treatment status from rtsas_dashboard
        t_status = None
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor(DictCursor) as cur:
                await cur.execute(
                    "SELECT * FROM patient_treatment_status WHERE hn = %s LIMIT 1;",
                    (hn,)
                )
                t_status = await cur.fetchone()

        # 3. Calculate NEWS score
        news = calculate_news_from_row(visit)

        # 4. Build archive record
        arrival_date = visit.get("vstdate")
        raw_time = visit.get("vsttime")
        arrival_time_str = None
        if raw_time is not None:
            formatted = format_time_str(raw_time)
            if formatted and formatted != "--:--":
                arrival_time_str = formatted

        archive_data = {
            "hn": hn,
            "vn": visit.get("vn") or (t_status.get("vn") if t_status else None),
            "sex": visit.get("sex"),
            "age": visit.get("age"),
            "chief_complaint": visit.get("chief_complaint"),
            "sbp": visit.get("sbp"),
            "dbp": visit.get("dbp"),
            "heart_rate": visit.get("heart_rate"),
            "resp_rate": visit.get("resp_rate"),
            "temperature": visit.get("temperature"),
            "spo2": visit.get("spo2"),
            "gcs": visit.get("gcs"),
            "weight": visit.get("weight"),
            "height": visit.get("height"),
            "news_score": news.totalScore,
            "risk_level": news.riskLevel,
            "has_single_alert": 1 if news.hasSingleParameterAlert else 0,
            "arrival_date": arrival_date,
            "arrival_time": arrival_time_str,
            "acknowledged_at": t_status.get("acknowledged_at") if t_status else None,
            "acknowledged_by": t_status.get("acknowledged_by") if t_status else None,
            "doctor_confirmed": t_status.get("doctor_confirmed", 0) if t_status else 0,
            "countdown_started_at": t_status.get("countdown_started_at") if t_status else None,
            "countdown_duration": t_status.get("countdown_duration", 3600) if t_status else 3600,
            "treatment_completed": t_status.get("treatment_completed", 0) if t_status else 0,
            "treatment_completed_at": t_status.get("treatment_completed_at") if t_status else None,
            "treatment_completed_by": t_status.get("treatment_completed_by") if t_status else None,
            "sepsis_ruled_out": t_status.get("sepsis_ruled_out", 0) if t_status else 0,
            "checklist_json": t_status.get("checklist_json") if t_status else None,
            "timeline_json": timeline_json,
            "outcome_label": outcome_label,
        }

        # 5. Insert into archive in rtsas_dashboard
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                cols = ", ".join(archive_data.keys())
                placeholders = ", ".join(["%s"] * len(archive_data))
                insert_sql = f"INSERT INTO treated_patient_archive ({cols}) VALUES ({placeholders})"
                await cur.execute(insert_sql, list(archive_data.values()))

                # 6. Remove from patient_treatment_status (rtsas_dashboard only)
                await cur.execute("DELETE FROM patient_treatment_status WHERE hn = %s;", (hn,))

        # Calculate stay duration if arrival_date & arrival_time_str exist
        stay_duration_str = "—"
        stay_minutes = None
        if arrival_date and arrival_time_str:
            try:
                arrival_dt = datetime.fromisoformat(f"{arrival_date}T{arrival_time_str}:00")
                diff = datetime.now() - arrival_dt
                stay_minutes = max(1, round(diff.total_seconds() / 60))
                if stay_minutes >= 60:
                    stay_duration_str = f"{stay_minutes // 60} ชม. {stay_minutes % 60} นาที"
                else:
                    stay_duration_str = f"{stay_minutes} นาที"
            except Exception:
                pass

        # Count completed checklist items if checklist_json exists
        steps_count = 0
        if archive_data.get("checklist_json"):
            try:
                cl = json.loads(archive_data["checklist_json"])
                for phase in cl:
                    for item in phase.get("items", []):
                        if item.get("status") == "completed":
                            steps_count += 1
            except Exception:
                pass

        steps_info = f" | ดำเนินการไป {steps_count} ขั้นตอน" if steps_count > 0 else ""

        # Record Stage 2: Patient archived to Dashboard
        try:
            from .log_service import record_log
            hn_clean = str(hn)[2:].strip() if str(hn).upper().startswith("HN") else str(hn).strip()
            hn_display = f"HN {hn_clean}"
            record_log(
                "Note",
                f"ย้ายข้อมูลผู้ป่วย {hn_display} ลง Dashboard (treated_patient_archive) สำเร็จ — ผลลัพธ์: {outcome_label} | ระยะเวลาใน ER: {stay_duration_str}{steps_info}",
                component="Dashboard_Archive",
                details={
                    "hn": hn,
                    "vn": archive_data.get("vn"),
                    "outcome_label": outcome_label,
                    "arrival_date": str(arrival_date),
                    "arrival_time": arrival_time_str,
                    "stay_duration_minutes": stay_minutes,
                    "completed_steps_count": steps_count,
                    "archive_table": "treated_patient_archive",
                    "archived_at": datetime.now().isoformat(),
                }
            )
        except Exception as log_err:
            logger.error(f"Failed to record archive log: {log_err}")

        logger.info(f"Archived treated patient HN {hn} (outcome: {outcome_label}) to rtsas_dashboard")
        return archive_data

    except Exception as e:
        logger.error(f"Failed to archive patient HN {hn}: {e}")
        raise e


async def get_archived_cases(
    target_date: Optional[str] = None,
    treated_only: bool = False
) -> List[Dict[str, Any]]:
    """
    Fetch archived treated patient cases from treated_patient_archive.
    If target_date is None, uses the most recent date with archived records.
    """
    try:
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor(DictCursor) as cur:
                if not target_date:
                    await cur.execute("SELECT MAX(arrival_date) as max_d FROM treated_patient_archive")
                    row = await cur.fetchone()
                    if row and row.get("max_d"):
                        target_date = row["max_d"].strftime("%Y-%m-%d") if hasattr(row["max_d"], 'strftime') else str(row["max_d"])
                    else:
                        return []

                query = "SELECT * FROM treated_patient_archive WHERE arrival_date = %s ORDER BY archived_at DESC"
                await cur.execute(query, (target_date,))
                rows = await cur.fetchall()

                cases = []
                for r in rows:
                    if treated_only and not (r.get("treatment_completed") or r.get("sepsis_ruled_out")):
                        continue

                    # Format time
                    raw_time = r.get("arrival_time")
                    time_str = "--:--"
                    if raw_time:
                        if hasattr(raw_time, 'strftime'):
                            time_str = raw_time.strftime("%H:%M")
                        else:
                            ts = str(raw_time)
                            time_str = ts[:5] if len(ts) >= 5 else ts

                    # Format gender
                    sex_val = str(r.get("sex", "")).strip().lower()
                    if sex_val in ("1", "ชาย", "male", "m"):
                        gender = "ชาย"
                    elif sex_val in ("2", "หญิง", "female", "f"):
                        gender = "หญิง"
                    else:
                        gender = "ไม่ระบุ"

                    # Mask HN
                    hn_raw = str(r.get("hn", ""))
                    digits = "".join(c for c in hn_raw if c.isdigit())
                    masked_hn = f"HN****{digits[-4:]}" if len(digits) > 4 else f"HN****{digits}"

                    cases.append({
                        "id": hn_raw,
                        "masked_hn": masked_hn,
                        "gender": gender,
                        "age": r.get("age") or 0,
                        "news_score": r.get("news_score", 0),
                        "risk_level": r.get("risk_level", "low"),
                        "has_single_alert": bool(r.get("has_single_alert", 0)),
                        "arrival_date": str(r.get("arrival_date", "")),
                        "arrival_time": time_str,
                        "is_treated": True,
                        "treatment_completed": bool(r.get("treatment_completed", 0)),
                        "sepsis_ruled_out": bool(r.get("sepsis_ruled_out", 0)),
                        "treatment_completed_at": _format_dt(r.get("treatment_completed_at")),
                        "treated_by": r.get("treatment_completed_by") or r.get("acknowledged_by") or "ทีมแพทย์/พยาบาล ER",
                        "outcome_label": r.get("outcome_label") or "ปกติ",
                        "chief_complaint": r.get("chief_complaint") or "ไม่ระบุอาการ",
                        "vitals": {
                            "sbp": r.get("sbp"),
                            "dbp": r.get("dbp"),
                            "heart_rate": r.get("heart_rate"),
                            "resp_rate": r.get("resp_rate"),
                            "temperature": r.get("temperature"),
                            "spo2": r.get("spo2"),
                            "gcs": r.get("gcs"),
                        },
                        "checklist_json": r.get("checklist_json"),
                        "timeline_json": r.get("timeline_json"),
                        "archived_at": _format_dt(r.get("archived_at")),
                    })

                return cases
    except Exception as e:
        logger.error(f"Failed to fetch archived cases: {e}")
        return []


async def get_archived_stats() -> Dict[str, Any]:
    """
    Calculate daily statistics from the treated_patient_archive table.
    Returns dates, summary_today, and daily_history.
    """
    try:
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor(DictCursor) as cur:
                # Get distinct dates with archived records
                await cur.execute(
                    "SELECT DISTINCT arrival_date as d FROM treated_patient_archive "
                    "WHERE arrival_date IS NOT NULL ORDER BY arrival_date DESC LIMIT 14"
                )
                date_rows = await cur.fetchall()
                dates = []
                for r in date_rows:
                    d = r.get("d")
                    if d:
                        dates.append(d.strftime("%Y-%m-%d") if hasattr(d, 'strftime') else str(d))

                if not dates:
                    return {
                        "dates": [],
                        "summary_today": {
                            "date": datetime.now().strftime("%Y-%m-%d"),
                            "total_cases": 0,
                            "high_risk_cases": 0,
                            "treated_completed": 0,
                            "ruled_out": 0,
                            "active_treating": 0,
                            "compliance_rate": 0.0,
                        },
                        "daily_history": []
                    }

                daily_history = []
                for d_str in dates:
                    await cur.execute(
                        "SELECT COUNT(*) as total, "
                        "SUM(CASE WHEN news_score >= 5 OR has_single_alert = 1 THEN 1 ELSE 0 END) as high_risk, "
                        "SUM(CASE WHEN treatment_completed = 1 THEN 1 ELSE 0 END) as treated, "
                        "SUM(CASE WHEN sepsis_ruled_out = 1 THEN 1 ELSE 0 END) as ruled_out "
                        "FROM treated_patient_archive WHERE arrival_date = %s",
                        (d_str,)
                    )
                    row = await cur.fetchone()
                    total = int(row.get("total", 0) or 0)
                    high_risk = int(row.get("high_risk", 0) or 0)
                    treated = int(row.get("treated", 0) or 0)
                    ruled_out = int(row.get("ruled_out", 0) or 0)

                    compliance_rate = round((treated / high_risk) * 100, 1) if high_risk > 0 else (100.0 if total > 0 else 0.0)

                    daily_history.append({
                        "date": d_str,
                        "total_cases": total,
                        "high_risk_cases": high_risk,
                        "treated_completed": treated,
                        "ruled_out": ruled_out,
                        "active_treating": 0,
                        "compliance_rate": compliance_rate,
                    })

                return {
                    "dates": dates,
                    "summary_today": daily_history[0] if daily_history else {
                        "date": datetime.now().strftime("%Y-%m-%d"),
                        "total_cases": 0,
                        "high_risk_cases": 0,
                        "treated_completed": 0,
                        "ruled_out": 0,
                        "active_treating": 0,
                        "compliance_rate": 0.0,
                    },
                    "daily_history": daily_history,
                }
    except Exception as e:
        logger.error(f"Failed to get archived stats: {e}")
        return {
            "dates": [],
            "summary_today": {
                "date": datetime.now().strftime("%Y-%m-%d"),
                "total_cases": 0,
                "high_risk_cases": 0,
                "treated_completed": 0,
                "ruled_out": 0,
                "active_treating": 0,
                "compliance_rate": 0.0,
            },
            "daily_history": []
        }


async def clear_treated_statuses() -> List[str]:
    """
    Clear/remove all treatment completion records from patient_treatment_status
    where treatment_completed = 1.
    Does NOT touch active treatments (treatment_completed = 0) nor raw patient visits.
    Returns list of cleared HNs.
    """
    if not dashboard_pool.pool or getattr(dashboard_pool.pool, '_closed', False):
        logger.warning("Dashboard database pool is not available — skipped clearing patient_treatment_status")
        return []

    query_select = "SELECT hn FROM patient_treatment_status WHERE treatment_completed = 1 OR sepsis_ruled_out = 1;"
    query_delete = "DELETE FROM patient_treatment_status WHERE treatment_completed = 1 OR sepsis_ruled_out = 1;"
    try:
        async with dashboard_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query_select)
                rows = await cur.fetchall()
                cleared_hns = [str(r[0]) for r in rows]
                if cleared_hns:
                    await cur.execute(query_delete)
        logger.info(f"Cleared {len(cleared_hns)} treated records from patient_treatment_status: {cleared_hns}")
        return cleared_hns
    except Exception as e:
        logger.warning(f"Could not clear treated statuses from DB: {e}")
        return []
