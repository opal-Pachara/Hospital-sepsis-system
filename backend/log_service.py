import os
import json
import sqlite3
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from threading import Lock

logger = logging.getLogger(__name__)

# Determine SQLite Log DB path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.getenv("RTSAS_LOG_DIR") or os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
LOG_DB_PATH = os.path.join(DATA_DIR, "timestamp_logs.db")

_lock = Lock()

TEST_LOG_MARKERS = ("TEST_HN_SYNC", "API_TEST_HN_999", "HN_SIM_001", "test_hn")

COMPONENT_GROUPS: Dict[str, tuple] = {
    "SYNC": ("HOSxP_Sync", "Scheduler"),
    "CLINICAL": ("Clinical_Treatment", "Dashboard_Archive"),
    "DB": ("HOSxP_DB", "Failover_Buffer"),
    "ADMIN": ("Admin_DB_Insert", "Admin_Dashboard", "Admin"),
}


def _is_test_log(message: str, details_str: Optional[str]) -> bool:
    combined = f"{message or ''} {details_str or ''}".lower()
    return any(marker.lower() in combined for marker in TEST_LOG_MARKERS)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(LOG_DB_PATH, timeout=20.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def init_log_db():
    """Ensure timestamp log database table exists and purge lingering unit-test noise."""
    with _lock:
        conn = get_connection()
        try:
            conn.execute("""
            CREATE TABLE IF NOT EXISTS timestamp_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                pid INTEGER DEFAULT 0,
                level TEXT NOT NULL,
                component TEXT NOT NULL,
                message TEXT NOT NULL,
                details_json TEXT
            );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_ts_logs ON timestamp_logs(timestamp);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_level_logs ON timestamp_logs(level);")
            conn.execute("""
            DELETE FROM timestamp_logs
            WHERE message LIKE '%TEST_HN_SYNC%'
               OR message LIKE '%API_TEST_HN_999%'
               OR message LIKE '%HN_SIM_001%'
               OR LOWER(message) LIKE '%test_hn%'
               OR COALESCE(details_json, '') LIKE '%TEST_HN_SYNC%'
               OR COALESCE(details_json, '') LIKE '%API_TEST_HN_999%'
               OR COALESCE(details_json, '') LIKE '%HN_SIM_001%'
               OR LOWER(COALESCE(details_json, '')) LIKE '%test_hn%';
            """)
            conn.execute("""
            UPDATE timestamp_logs
            SET message = REPLACE(message, 'HN HN', 'HN ')
            WHERE message LIKE '%HN HN%';
            """)
            conn.commit()
        except Exception as e:
            logger.error(f"Failed to init timestamp log DB: {e}")
        finally:
            conn.close()


# Initialize on import
init_log_db()


def record_log(
    level: str,
    message: str,
    component: str = "HOSxP_DB",
    details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Record a log entry with precise timestamp into the log database.
    Format inspired by server/MySQL daemon logs:
    YYYY-MM-DD HH:MM:SS [Level] Component: message
    """
    now = datetime.now()
    ts_str = now.strftime("%Y-%m-%d %H:%M:%S")
    pid = os.getpid()
    details_str = json.dumps(details or {}, ensure_ascii=False) if details else None

    # Normalize level text: 'Note', 'Warning', 'ERROR'
    lvl_upper = level.upper()
    if lvl_upper in ("NOTE", "INFO"):
        lvl_formatted = "Note"
    elif lvl_upper in ("WARN", "WARNING"):
        lvl_formatted = "Warning"
    else:
        lvl_formatted = "ERROR"

    # Isolate automated test traffic so live diagnostic logs stay clean
    if _is_test_log(message, details_str):
        return {
            "id": 0,
            "timestamp": ts_str,
            "pid": pid,
            "level": lvl_formatted,
            "component": component,
            "message": message,
            "details": details or {},
        }

    with _lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute("""
            INSERT INTO timestamp_logs (timestamp, pid, level, component, message, details_json)
            VALUES (?, ?, ?, ?, ?, ?);
            """, (ts_str, pid, lvl_formatted, component, message, details_str))
            conn.commit()
            return {
                "id": cur.lastrowid,
                "timestamp": ts_str,
                "pid": pid,
                "level": lvl_formatted,
                "component": component,
                "message": message,
                "details": details or {}
            }
        except Exception as e:
            logger.error(f"Failed to insert into timestamp_logs: {e}")
            return {}
        finally:
            conn.close()


def get_logs(
    limit: int = 50,
    level: Optional[str] = None,
    component: Optional[str] = None,
    search: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Query recent logs with optional filtering (including category groups and JSON details search)."""
    with _lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            conditions = []
            params: List[Any] = []

            if level and level.upper() != 'ALL':
                conditions.append("UPPER(level) = ?")
                params.append(level.upper())

            if component and component.upper() != 'ALL':
                group_key = component.upper()
                if group_key in COMPONENT_GROUPS:
                    group_comps = COMPONENT_GROUPS[group_key]
                    placeholders = ", ".join(["?"] * len(group_comps))
                    conditions.append(f"component IN ({placeholders})")
                    params.extend(group_comps)
                else:
                    conditions.append("component = ?")
                    params.append(component)

            if search:
                conditions.append("(message LIKE ? OR component LIKE ? OR COALESCE(details_json, '') LIKE ?)")
                params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

            where_sql = f"WHERE {' AND '.join(conditions)}" if conditions else ""
            query = f"""
            SELECT id, timestamp, pid, level, component, message, details_json
            FROM timestamp_logs
            {where_sql}
            ORDER BY id DESC
            LIMIT ?;
            """
            params.append(limit)
            cur.execute(query, params)
            rows = cur.fetchall()

            result = []
            for r in rows:
                details = {}
                if r["details_json"]:
                    try:
                        details = json.loads(r["details_json"])
                    except Exception:
                        pass
                result.append({
                    "id": r["id"],
                    "timestamp": r["timestamp"],
                    "pid": r["pid"],
                    "level": r["level"],
                    "component": r["component"],
                    "message": r["message"],
                    "details": details
                })
            return result
        except Exception as e:
            logger.error(f"Failed to query timestamp_logs: {e}")
            return []
        finally:
            conn.close()


def get_log_summary() -> Dict[str, Any]:
    """Summary of log database status and counts by severity and category."""
    with _lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM timestamp_logs;")
            total = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM timestamp_logs WHERE level = 'ERROR';")
            errors = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM timestamp_logs WHERE level = 'Warning';")
            warnings = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM timestamp_logs WHERE level = 'Note';")
            notes = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM timestamp_logs WHERE component IN ('Clinical_Treatment', 'Dashboard_Archive');")
            clinical_logs = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM timestamp_logs WHERE component IN ('HOSxP_Sync', 'Scheduler');")
            sync_logs = cur.fetchone()[0]

            cur.execute("SELECT timestamp, level, component, message FROM timestamp_logs ORDER BY id DESC LIMIT 1;")
            last_row = cur.fetchone()

            last_entry = None
            if last_row:
                last_entry = {
                    "timestamp": last_row[0],
                    "level": last_row[1],
                    "component": last_row[2],
                    "message": last_row[3],
                }

            return {
                "total_logs": total,
                "error_logs": errors,
                "warning_logs": warnings,
                "note_logs": notes,
                "clinical_logs": clinical_logs,
                "sync_logs": sync_logs,
                "last_entry": last_entry,
                "log_db_path": LOG_DB_PATH,
            }
        except Exception as e:
            logger.error(f"Failed to get log summary: {e}")
            return {
                "total_logs": 0,
                "error_logs": 0,
                "warning_logs": 0,
                "note_logs": 0,
                "clinical_logs": 0,
                "sync_logs": 0,
                "last_entry": None,
            }
        finally:
            conn.close()


def clear_logs() -> int:
    """Clear all timestamp logs from SQLite database and reset autoincrement ID."""
    with _lock:
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM timestamp_logs;")
            row = cur.fetchone()
            count = row[0] if row else 0

            cur.execute("DELETE FROM timestamp_logs;")
            try:
                cur.execute("DELETE FROM sqlite_sequence WHERE name='timestamp_logs';")
            except Exception:
                pass
            conn.commit()
            return count
        except Exception as e:
            logger.error(f"Failed to clear timestamp_logs: {e}")
            return 0
        finally:
            conn.close()
