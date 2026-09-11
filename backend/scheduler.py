import asyncio
import logging
from datetime import datetime, date
from aiomysql import DictCursor
from typing import List, Dict, Any, Optional

from .database import db_pool
from .schemas import SepsisAlertPayload, PatientListItem
from .services import (
    calculate_news_from_row,
    row_to_arrival_iso,
    sex_label,
    format_time_str,
    format_date_str,
)

logger = logging.getLogger(__name__)

# Keep track of previously seen readings to avoid re-broadcasting on every poll
last_seen_vitals: Dict[str, bool] = {}

# Cache of all today's patients (refreshed every poll)
_patients_cache: List[Dict[str, Any]] = []

# Track last midnight-clear date to avoid clearing multiple times per day
_last_clear_date: date | None = None


# ---------------------------------------------------------------------------
# Cache management helpers
# ---------------------------------------------------------------------------

def clear_cache(preserve_hns: Optional[List[str]] = None) -> dict:
    """Clear last_seen_vitals and patient cache, preserving any HNs currently in active treatment. Returns stats."""
    global last_seen_vitals, _patients_cache
    preserve_set = set(str(hn).strip() for hn in (preserve_hns or []))

    total_vitals = len(last_seen_vitals)
    total_patients = len(_patients_cache)

    if not preserve_set:
        cleared_vitals = total_vitals
        cleared_patients = total_patients
        last_seen_vitals = {}
        _patients_cache = []
        retained_vitals = 0
        retained_patients = 0
    else:
        # Keep vitals whose reading key starts with any preserved HN: f"{hn}_"
        new_vitals = {}
        for k, v in last_seen_vitals.items():
            hn_part = k.split('_')[0]
            if hn_part in preserve_set:
                new_vitals[k] = v

        # Keep patient cache for preserved HNs
        new_patients = [p for p in _patients_cache if str(p.get('hn', '')).strip() in preserve_set]

        cleared_vitals = total_vitals - len(new_vitals)
        cleared_patients = total_patients - len(new_patients)
        retained_vitals = len(new_vitals)
        retained_patients = len(new_patients)

        last_seen_vitals = new_vitals
        _patients_cache = new_patients

    logger.info(
        f"Cache cleared: {cleared_vitals} vitals, {cleared_patients} patients removed. "
        f"Preserved {retained_patients} active patients ({list(preserve_set)})."
    )
    return {
        "cleared_vitals": cleared_vitals,
        "cleared_patients": cleared_patients,
        "retained_vitals": retained_vitals,
        "retained_patients": retained_patients,
        "preserved_hns": list(preserve_set),
    }


def get_cache_stats() -> dict:
    """Return current cache size stats."""
    return {
        "last_seen_vitals_count": len(last_seen_vitals),
        "patients_cache_count": len(_patients_cache),
        "last_clear_date": str(_last_clear_date) if _last_clear_date else None,
    }


# ---------------------------------------------------------------------------
# SQL queries
# ---------------------------------------------------------------------------

QUERY_PATIENT_VISITS = """
SELECT
    id,
    vstdate,
    vsttime,
    hn,
    vn,
    patient_name,
    sex,
    age,
    chief_complaint,
    gcs,
    spo2,
    heart_rate,
    sbp,
    dbp,
    resp_rate,
    temperature,
    weight,
    height,
    created_at
FROM patient_visits
WHERE vstdate = COALESCE(
    (SELECT MAX(vstdate) FROM patient_visits WHERE vstdate = CURDATE()),
    (SELECT MAX(vstdate) FROM patient_visits)
)
ORDER BY created_at DESC, vsttime DESC
LIMIT 200;
"""

QUERY_OPDSCREEN_FALLBACK = """
SELECT
    o.hn,
    o.vn,
    o.vstdate,
    o.vsttime,
    o.sex,
    (COALESCE(e.gcs_e,0) + COALESCE(e.gcs_v,0) + COALESCE(e.gcs_m,0)) AS gcs,
    e.o2sat AS spo2,
    o.pulse AS heart_rate,
    o.bps AS sbp,
    o.bpd AS dbp,
    o.rr AS resp_rate,
    o.temperature,
    o.weight,
    o.height,
    e.chief_complaint
FROM opdscreen o
LEFT JOIN er_nursing_detail e ON o.vn = e.vn
WHERE o.vstdate = (SELECT MAX(vstdate) FROM opdscreen)
ORDER BY o.vsttime DESC
LIMIT 200;
"""


# ---------------------------------------------------------------------------
# Fetch from DB (patient_visits first, fallback to opdscreen JOIN)
# ---------------------------------------------------------------------------

async def fetch_vitals_from_db() -> List[Dict[str, Any]]:
    """
    Fetch today's vital signs.
    Primary source: patient_visits table.
    Fallback: opdscreen JOIN er_nursing_detail (legacy HOSxP schema).
    """
    try:
        async with db_pool.get_connection() as conn:
            async with conn.cursor(DictCursor) as cursor:
                # Try patient_visits first
                await cursor.execute(QUERY_PATIENT_VISITS)
                rows = await cursor.fetchall()

                if rows:
                    logger.info(f"Fetched {len(rows)} rows from patient_visits.")
                    return [dict(r) for r in rows]

                # Fallback to HOSxP legacy tables
                logger.info("patient_visits is empty — falling back to opdscreen JOIN er_nursing_detail.")
                await cursor.execute(QUERY_OPDSCREEN_FALLBACK)
                rows = await cursor.fetchall()
                logger.info(f"Fetched {len(rows)} rows from opdscreen (fallback).")
                return [dict(r) for r in rows]

    except Exception as e:
        logger.error(f"Failed to fetch vitals: {e}")
        return []


# ---------------------------------------------------------------------------
# Build PatientListItem list from raw rows
# ---------------------------------------------------------------------------

def build_patient_list(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert raw DB rows into PatientListItem dicts, computing NEWS for each."""
    result = []
    for row in rows:
        try:
            hn = str(row.get('hn', ''))
            vn = str(row.get('vn', '') or '')
            vstdate = row.get('vstdate')
            vsttime = row.get('vsttime')

            news = calculate_news_from_row(row)
            arrival_iso = row_to_arrival_iso(vstdate, vsttime)

            vstdate_str = format_date_str(vstdate)
            vsttime_str = format_time_str(vsttime)

            item = PatientListItem(
                id=hn,
                hn=hn,
                vn=vn if vn else None,
                patient_name=row.get('patient_name'),
                age=_si(row.get('age')),
                vstdate=vstdate_str,
                vsttime=vsttime_str,
                sex=sex_label(row.get('sex')),
                chief_complaint=row.get('chief_complaint'),
                weight=_sf(row.get('weight')),
                height=_sf(row.get('height')),
                gcs=_si(row.get('gcs')),
                spo2=_sf(row.get('spo2') or row.get('o2sat')),
                heart_rate=_sf(row.get('heart_rate') or row.get('pulse')),
                sbp=_sf(row.get('sbp') or row.get('bps')),
                dbp=_sf(row.get('dbp') or row.get('bpd')),
                resp_rate=_sf(row.get('resp_rate') or row.get('rr')),
                temperature=_sf(row.get('temperature')),
                news_result=news,
                arrival_time=arrival_iso,
            )
            result.append(item.model_dump())
        except Exception as e:
            logger.error(f"Error building patient list item for HN {row.get('hn')}: {e}")
    return result


# ---------------------------------------------------------------------------
# Process vitals — compute NEWS and broadcast alerts via WebSocket
# ---------------------------------------------------------------------------

async def process_vitals():
    global _patients_cache

    logger.info("Polling sepsis_db for new vital signs...")
    rows = await fetch_vitals_from_db()

    # Update the cache used by GET /api/patients
    _patients_cache = build_patient_list(rows)

    # Broadcast new alerts via WebSocket
    from .main import broadcast_message  # imported here to avoid circular imports

    for row in rows:
        try:
            hn = str(row.get('hn', ''))
            vstdate = row.get('vstdate')
            vsttime = row.get('vsttime')
            vstdate_str = format_date_str(vstdate)
            vsttime_str = format_time_str(vsttime)
            reading_key = f"{hn}_{vsttime_str}"

            if reading_key not in last_seen_vitals:
                last_seen_vitals[reading_key] = True

                news = calculate_news_from_row(row)
                arrival_iso = row_to_arrival_iso(vstdate, vsttime)

                payload = SepsisAlertPayload(
                    hn=hn,
                    vn=str(row.get('vn') or ''),
                    patient_name=row.get('patient_name'),
                    age=_si(row.get('age')),
                    gcs=_si(row.get('gcs')),
                    spo2=_sf(row.get('spo2') or row.get('o2sat')),
                    heart_rate=_sf(row.get('heart_rate') or row.get('pulse')),
                    sbp=_sf(row.get('sbp') or row.get('bps')),
                    dbp=_sf(row.get('dbp') or row.get('bpd')),
                    resp_rate=_sf(row.get('resp_rate') or row.get('rr')),
                    temperature=_sf(row.get('temperature')),
                    sex=sex_label(row.get('sex')),
                    chief_complaint=row.get('chief_complaint'),
                    weight=_sf(row.get('weight')),
                    height=_sf(row.get('height')),
                    vstdate=vstdate_str,
                    vsttime=vsttime_str,
                    news_result=news,
                    is_new_alert=True,
                    timestamp=arrival_iso,
                )
                await broadcast_message(payload.model_dump_json())

        except Exception as e:
            logger.error(f"Error processing row for HN {row.get('hn')}: {e}")


# ---------------------------------------------------------------------------
# Background polling loop
# ---------------------------------------------------------------------------

async def background_scheduler():
    global _last_clear_date
    logger.info("Background scheduler started — polling every 10 seconds.")
    while True:
        try:
            # Midnight auto-clear: clear last_seen_vitals once per day at midnight
            today = date.today()
            if _last_clear_date != today:
                _last_clear_date = today
                last_seen_vitals.clear()
                logger.info(f"Midnight auto-clear: flushed last_seen_vitals for new day {today}")

            await process_vitals()
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
        await asyncio.sleep(10)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sf(val) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _si(val) -> int | None:
    if val is None:
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Expose cache for the REST endpoint
# ---------------------------------------------------------------------------

def get_patients_cache() -> List[Dict[str, Any]]:
    return _patients_cache
