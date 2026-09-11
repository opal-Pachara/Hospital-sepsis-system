import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from aiomysql import DictCursor

from .database import db_pool

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

async def init_treatment_table():
    """Ensure the patient_treatment_status table exists in sepsis_db."""
    try:
        async with db_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(CREATE_TABLE_SQL)
                logger.info("Initialized patient_treatment_status table.")
    except Exception as e:
        logger.error(f"Failed to initialize patient_treatment_status table: {e}")

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
    """Return all treatment statuses indexed by HN."""
    try:
        async with db_pool.get_connection() as conn:
            async with conn.cursor(DictCursor) as cur:
                await cur.execute("SELECT * FROM patient_treatment_status;")
                rows = await cur.fetchall()
                result = {}
                for row in rows:
                    st = _row_to_status_dict(row)
                    result[st["hn"]] = st
                return result
    except Exception as e:
        logger.error(f"Error fetching treatment statuses: {e}")
        return {}

async def get_treatment_status(hn: str) -> Optional[Dict[str, Any]]:
    """Return treatment status for a specific HN."""
    try:
        async with db_pool.get_connection() as conn:
            async with conn.cursor(DictCursor) as cur:
                await cur.execute("SELECT * FROM patient_treatment_status WHERE hn = %s LIMIT 1;", (hn,))
                row = await cur.fetchone()
                if row:
                    return _row_to_status_dict(row)
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
        async with db_pool.get_connection() as conn:
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

async def complete_treatment(hn: str, completed_by: str = "Nurse/System") -> Dict[str, Any]:
    """Mark a patient's treatment as completed."""
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
        async with db_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, (hn, now_str, completed_by))
        logger.info(f"Marked treatment completed centrally for HN {hn} by {completed_by}")
        status = await get_treatment_status(hn)
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
    """Mark sepsis as ruled out for a patient."""
    query = """
    INSERT INTO patient_treatment_status (hn, sepsis_ruled_out)
    VALUES (%s, 1)
    ON DUPLICATE KEY UPDATE
        sepsis_ruled_out = 1,
        updated_at = NOW();
    """
    try:
        async with db_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, (hn,))
        logger.info(f"Marked sepsis ruled out centrally for HN {hn}")
        status = await get_treatment_status(hn)
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
        async with db_pool.get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, (hn, checklist_json))
        status = await get_treatment_status(hn)
        return status or {"hn": hn, "checklist_json": checklist_json}
    except Exception as e:
        logger.error(f"Failed to update checklist for HN {hn}: {e}")
        raise e
