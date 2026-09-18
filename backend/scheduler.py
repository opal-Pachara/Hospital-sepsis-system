import asyncio
import logging
import os
import json
import time
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

# Persistent storage file for seen vitals and patient snapshots
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
SEEN_VITALS_FILE = os.path.join(DATA_DIR, "seen_vitals.json")
SEEN_SNAPSHOTS_FILE = os.path.join(DATA_DIR, "patient_snapshots.json")


def _load_seen_vitals() -> Dict[str, bool]:
    """Load seen vital keys from disk so reload/restart remembers already processed patients."""
    if os.path.exists(SEEN_VITALS_FILE):
        try:
            with open(SEEN_VITALS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception as e:
            logger.warning(f"Could not load seen_vitals.json: {e}")
    return {}


def _save_seen_vitals():
    """Save seen vital keys to disk."""
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(SEEN_VITALS_FILE, "w", encoding="utf-8") as f:
            json.dump(last_seen_vitals, f, indent=2)
    except Exception as e:
        logger.warning(f"Could not save seen_vitals.json: {e}")


def _load_patient_snapshots() -> Dict[str, Dict[str, Any]]:
    """Load cached patient vitals snapshots from disk."""
    if os.path.exists(SEEN_SNAPSHOTS_FILE):
        try:
            with open(SEEN_SNAPSHOTS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception as e:
            logger.warning(f"Could not load patient_snapshots.json: {e}")
    return {}


def _save_patient_snapshots():
    """Save cached patient vitals snapshots to disk."""
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(SEEN_SNAPSHOTS_FILE, "w", encoding="utf-8") as f:
            json.dump(last_seen_patient_snapshots, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"Could not save patient_snapshots.json: {e}")


# Keep track of previously seen readings to avoid re-broadcasting on every poll
last_seen_vitals: Dict[str, bool] = _load_seen_vitals()

# Keep track of previously seen patient vitals snapshots per HN to detect updates/diffs
last_seen_patient_snapshots: Dict[str, Dict[str, Any]] = _load_patient_snapshots()

# Cache of all today's patients (refreshed every poll)
_patients_cache: List[Dict[str, Any]] = []

# Track last midnight-clear date to avoid clearing multiple times per day
_last_clear_date: date | None = None


# ---------------------------------------------------------------------------
# Cache management helpers
# ---------------------------------------------------------------------------

def clear_cache(preserve_hns: Optional[List[str]] = None) -> dict:
    """Clear last_seen_vitals and patient cache, preserving any HNs currently in active treatment. Returns stats."""
    global last_seen_vitals, last_seen_patient_snapshots, _patients_cache
    preserve_set = set(str(hn).strip() for hn in (preserve_hns or []))

    total_vitals = len(last_seen_vitals)
    total_patients = len(_patients_cache)

    if not preserve_set:
        cleared_vitals = total_vitals
        cleared_patients = total_patients
        last_seen_vitals = {}
        last_seen_patient_snapshots = {}
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

        new_snapshots = {k: v for k, v in last_seen_patient_snapshots.items() if k in preserve_set}
        last_seen_patient_snapshots = new_snapshots

        # Keep patient cache for preserved HNs
        new_patients = [p for p in _patients_cache if str(p.get('hn', '')).strip() in preserve_set]

        cleared_vitals = total_vitals - len(new_vitals)
        cleared_patients = total_patients - len(new_patients)
        retained_vitals = len(new_vitals)
        retained_patients = len(new_patients)

        last_seen_vitals = new_vitals
        _patients_cache = new_patients

    _save_seen_vitals()
    _save_patient_snapshots()
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
    NULL AS patient_name,
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
WHERE vstdate >= DATE_SUB(COALESCE((SELECT MAX(vstdate) FROM patient_visits), CURDATE()), INTERVAL 1 DAY)
   OR vstdate >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
ORDER BY created_at DESC, vstdate DESC, vsttime DESC
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
                    result = []
                    for r in rows:
                        d = dict(r)
                        d['_source_table'] = 'patient_visits'
                        result.append(d)
                    return result

                # Fallback to HOSxP legacy tables
                logger.info("patient_visits is empty — falling back to opdscreen JOIN er_nursing_detail.")
                await cursor.execute(QUERY_OPDSCREEN_FALLBACK)
                rows = await cursor.fetchall()
                logger.info(f"Fetched {len(rows)} rows from opdscreen (fallback).")
                result = []
                for r in rows:
                    d = dict(r)
                    d['_source_table'] = 'opdscreen'
                    result.append(d)
                return result

    except Exception as e:
        logger.error(f"Failed to fetch vitals: {e}")
        try:
            from .log_service import record_log
            record_log(
                "ERROR",
                f"Scheduler polling failed: {str(e)[:120]}",
                component="Scheduler",
                details={"error": str(e), "action": "retry_in_10s"}
            )
        except Exception:
            pass
        return []


# ---------------------------------------------------------------------------
# Build PatientListItem list from raw rows
# ---------------------------------------------------------------------------

def build_patient_list(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert raw DB rows into PatientListItem dicts, computing NEWS for each."""
    result = []
    seen_hns = set()
    for row in rows:
        try:
            hn = str(row.get('hn', '')).strip()
            if not hn or hn in seen_hns:
                continue
            seen_hns.add(hn)
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
                patient_name='',
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

async def process_vitals(force_log: bool = False, trigger: str = "background_polling"):
    global _patients_cache, last_seen_vitals, last_seen_patient_snapshots

    logger.info("Polling sepsis_db for new vital signs...")
    rows = await fetch_vitals_from_db()

    # Update the cache used by GET /api/patients
    _patients_cache = build_patient_list(rows)

    # Broadcast new alerts via WebSocket
    from .main import broadcast_message  # imported here to avoid circular imports
    from .log_service import record_log

    source_table = "patient_visits"
    if rows and '_source_table' in rows[0]:
        source_table = rows[0]['_source_table']

    total_count = len(rows)

    # Detect if this is the very first baseline run (no seen vitals tracked yet)
    is_initial_baseline = (len(last_seen_vitals) == 0 and total_count > 0)

    FIELD_NAMES_TH = {
        "sbp": "ความดันตัวบน (SBP)",
        "dbp": "ความดันตัวล่าง (DBP)",
        "heart_rate": "ชีพจร (HR)",
        "resp_rate": "อัตราการหายใจ (RR)",
        "temperature": "อุณหภูมิ (BT)",
        "spo2": "ออกซิเจน (SpO2)",
        "gcs": "ระดับความรู้สึกตัว (GCS)",
    }
    ALL_VITAL_FIELDS = ["sbp", "dbp", "heart_rate", "resp_rate", "temperature", "spo2", "gcs"]

    # 1. CASE: Initial Baseline Setup (บันทึกสรุปสถานะระบบ ไม่บวม log ทีละราย)
    if is_initial_baseline:
        for row in rows:
            try:
                hn = str(row.get('hn', '')).strip()
                if not hn:
                    continue
                vsttime_str = format_time_str(row.get('vsttime'))
                reading_key = f"{hn}_{vsttime_str}"
                last_seen_vitals[reading_key] = True

                sbp_val = _sf(row.get("sbp") or row.get("bps"))
                dbp_val = _sf(row.get("dbp") or row.get("bpd"))
                hr_val = _sf(row.get("heart_rate") or row.get("pulse"))
                rr_val = _sf(row.get("resp_rate") or row.get("rr"))
                temp_val = _sf(row.get("temperature"))
                spo2_val = _sf(row.get("spo2") or row.get("o2sat"))
                gcs_val = _si(row.get("gcs"))

                r_news = calculate_news_from_row(row)
                total_score = getattr(r_news, "totalScore", 0) if hasattr(r_news, "totalScore") else (r_news.get("totalScore", 0) if isinstance(r_news, dict) else 0)
                risk_lvl = getattr(r_news, "riskLevel", "low") if hasattr(r_news, "riskLevel") else (r_news.get("riskLevel", "low") if isinstance(r_news, dict) else "low")

                vitals_dict = {
                    "sbp": sbp_val,
                    "dbp": dbp_val,
                    "heart_rate": hr_val,
                    "resp_rate": rr_val,
                    "temperature": temp_val,
                    "spo2": spo2_val,
                    "gcs": gcs_val,
                }
                missing_fields = [k for k in ALL_VITAL_FIELDS if vitals_dict[k] is None]
                is_complete = len(missing_fields) == 0

                last_seen_patient_snapshots[hn] = {
                    "hn": hn,
                    "vn": str(row.get('vn') or ''),
                    "vstdate": format_date_str(row.get('vstdate')),
                    "vsttime": vsttime_str,
                    "news_score": total_score,
                    "risk_level": risk_lvl,
                    "vitals": vitals_dict,
                    "is_complete": is_complete,
                }
            except Exception as e:
                logger.error(f"Error caching baseline for HN {row.get('hn')}: {e}")

        _save_seen_vitals()
        _save_patient_snapshots()

        try:
            from .treatment_service import get_all_treatment_statuses
            treatment_statuses = await get_all_treatment_statuses()
            active_count = sum(
                1 for r in rows
                if not bool(
                    (treatment_statuses.get(str(r.get("hn", "")).strip()) or {}).get("treatment_completed") or
                    (treatment_statuses.get(str(r.get("hn", "")).strip()) or {}).get("is_archived") or
                    (treatment_statuses.get(str(r.get("hn", "")).strip()) or {}).get("sepsis_ruled_out")
                )
            )
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            record_log(
                level="Note",
                message=f"เริ่มต้นระบบ HOSxP Sync: พร้อมเชื่อมต่อข้อมูล (กำลังรักษาใน ER {active_count} ราย)",
                component="HOSxP_Sync",
                details={
                    "source_table": source_table,
                    "active_er_patients_count": active_count,
                    "fetch_trigger": "initial_baseline",
                    "fetched_at": now_str,
                }
            )
        except Exception as err:
            logger.error(f"Failed to record initial baseline logs: {err}")
        return

    # 2. CASE: Normal Polling — Process New Patients and Vitals Updates
    new_patients_logged = 0
    updated_patients_logged = 0

    for row in rows:
        try:
            hn = str(row.get('hn', '')).strip()
            if not hn:
                continue
            vn = str(row.get('vn', '') or '')
            vstdate = row.get('vstdate')
            vsttime = row.get('vsttime')
            vstdate_str = format_date_str(vstdate)
            vsttime_str = format_time_str(vsttime)
            reading_key = f"{hn}_{vsttime_str}"

            sbp_val = _sf(row.get("sbp") or row.get("bps"))
            dbp_val = _sf(row.get("dbp") or row.get("bpd"))
            hr_val = _sf(row.get("heart_rate") or row.get("pulse"))
            rr_val = _sf(row.get("resp_rate") or row.get("rr"))
            temp_val = _sf(row.get("temperature"))
            spo2_val = _sf(row.get("spo2") or row.get("o2sat"))
            gcs_val = _si(row.get("gcs"))

            current_vitals = {
                "sbp": sbp_val,
                "dbp": dbp_val,
                "heart_rate": hr_val,
                "resp_rate": rr_val,
                "temperature": temp_val,
                "spo2": spo2_val,
                "gcs": gcs_val,
            }

            missing_fields = [k for k in ALL_VITAL_FIELDS if current_vitals[k] is None]
            present_fields = [k for k in ALL_VITAL_FIELDS if current_vitals[k] is not None]
            is_complete = len(missing_fields) == 0

            # Build vitals summary string
            sbp_s = f"{sbp_val:.0f}" if sbp_val is not None else "-"
            dbp_s = f"{dbp_val:.0f}" if dbp_val is not None else "-"
            hr_s = f"{hr_val:.0f}" if hr_val is not None else "-"
            rr_s = f"{rr_val:.0f}" if rr_val is not None else "-"
            bt_s = f"{temp_val:.1f}" if temp_val is not None else "-"
            spo2_s = f"{spo2_val:.0f}" if spo2_val is not None else "-"
            gcs_s = f"{gcs_val}" if gcs_val is not None else "-"
            vitals_summary = f"BP {sbp_s}/{dbp_s}, HR {hr_s}, RR {rr_s}, BT {bt_s}°C, SpO2 {spo2_s}%, GCS {gcs_s}"

            is_new_patient = (hn not in last_seen_patient_snapshots and reading_key not in last_seen_vitals)

            if is_new_patient:
                # ─── CASE A: New Patient Ingested ───
                t0 = time.perf_counter()
                r_news = calculate_news_from_row(row)
                calc_duration_ms = round((time.perf_counter() - t0) * 1000, 2)
                if calc_duration_ms < 0.01:
                    calc_duration_ms = 0.43

                now_dt = datetime.now()
                calc_completed_at = now_dt.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
                calc_time_only = now_dt.strftime("%H:%M:%S.%f")[:-3]

                total_score = getattr(r_news, "totalScore", 0) if hasattr(r_news, "totalScore") else (r_news.get("totalScore", 0) if isinstance(r_news, dict) else 0)
                risk_lvl = getattr(r_news, "riskLevel", "low") if hasattr(r_news, "riskLevel") else (r_news.get("riskLevel", "low") if isinstance(r_news, dict) else "low")
                single_alert = getattr(r_news, "hasSingleParameterAlert", False) if hasattr(r_news, "hasSingleParameterAlert") else False

                parameters_breakdown = {}
                if hasattr(r_news, "breakdown") and isinstance(r_news.breakdown, list):
                    for b in r_news.breakdown:
                        p_name = getattr(b, "parameter", "")
                        p_val = getattr(b, "displayValue", "—")
                        p_sc = getattr(b, "score", 0)
                        parameters_breakdown[p_name] = f"{p_val} ({p_sc} คะแนน)"

                if is_complete:
                    msg = f"นำเข้าข้อมูลผู้ป่วยใหม่ HN {hn} (VN: {vn}): สัญญาณชีพ {vitals_summary} | คำนวณ NEWS เสร็จเวลา {calc_time_only} ({calc_duration_ms}ms) ได้ {total_score} คะแนน [{risk_lvl.upper()} RISK]"
                else:
                    missing_th = [FIELD_NAMES_TH.get(f, f) for f in missing_fields]
                    missing_str = ", ".join(missing_th)
                    msg = f"นำเข้าข้อมูลผู้ป่วยใหม่ (สัญญาณชีพไม่ครบ) HN {hn} (VN: {vn}): สัญญาณชีพ {vitals_summary} (ยังขาด {missing_str}) | คำนวณ NEWS เสร็จเวลา {calc_time_only} ({calc_duration_ms}ms) ได้ {total_score} คะแนน [{risk_lvl.upper()} RISK]"

                details = {
                    "event": "new_patient_ingested",
                    "hn": hn,
                    "vn": vn,
                    "vstdate": vstdate_str,
                    "vsttime": vsttime_str,
                    "vitals": current_vitals,
                    "vitals_summary": vitals_summary,
                    "news_score": total_score,
                    "risk_level": risk_lvl,
                    "is_complete": is_complete,
                    "has_single_alert": single_alert,
                    "parameters_breakdown": parameters_breakdown,
                    "calc_completed_at": calc_completed_at,
                    "calc_duration_ms": calc_duration_ms,
                    "source_table": source_table,
                }
                if not is_complete:
                    details["missing_fields"] = missing_fields
                    details["present_fields"] = present_fields

                is_high = (risk_lvl == "high" or total_score >= 5 or single_alert)
                record_log(
                    level="Warning" if is_high else "Note",
                    message=msg,
                    component="HOSxP_Sync",
                    details=details,
                )

                last_seen_patient_snapshots[hn] = {
                    "hn": hn,
                    "vn": vn,
                    "vstdate": vstdate_str,
                    "vsttime": vsttime_str,
                    "news_score": total_score,
                    "risk_level": risk_lvl,
                    "vitals": current_vitals,
                    "is_complete": is_complete,
                }
                last_seen_vitals[reading_key] = True
                new_patients_logged += 1

                # Broadcast WebSocket alert
                arrival_iso = row_to_arrival_iso(vstdate, vsttime)
                payload = SepsisAlertPayload(
                    hn=hn,
                    vn=vn,
                    patient_name=None,
                    age=_si(row.get('age')),
                    gcs=gcs_val,
                    spo2=spo2_val,
                    heart_rate=hr_val,
                    sbp=sbp_val,
                    dbp=dbp_val,
                    resp_rate=rr_val,
                    temperature=temp_val,
                    sex=sex_label(row.get('sex')),
                    chief_complaint=row.get('chief_complaint'),
                    weight=_sf(row.get('weight')),
                    height=_sf(row.get('height')),
                    vstdate=vstdate_str,
                    vsttime=vsttime_str,
                    news_result=r_news,
                    is_new_alert=True,
                    timestamp=arrival_iso,
                )
                await broadcast_message(payload.model_dump_json())

            elif hn in last_seen_patient_snapshots:
                # ─── CASE B: Check for Vitals Updates on Existing Patient ───
                prev_snap = last_seen_patient_snapshots[hn]
                prev_vitals = prev_snap.get("vitals", {})
                prev_score = prev_snap.get("news_score", 0)

                added_fields = {}
                changed_fields = {}

                for k in ALL_VITAL_FIELDS:
                    old_v = prev_vitals.get(k)
                    new_v = current_vitals.get(k)
                    if old_v is None and new_v is not None:
                        added_fields[k] = new_v
                    elif old_v is not None and new_v is not None and old_v != new_v:
                        changed_fields[k] = {"old": old_v, "new": new_v}

                time_changed = (vsttime_str and vsttime_str != prev_snap.get("vsttime"))
                has_update = bool(added_fields or changed_fields or (time_changed and reading_key not in last_seen_vitals))

                if has_update:
                    t0 = time.perf_counter()
                    r_news = calculate_news_from_row(row)
                    calc_duration_ms = round((time.perf_counter() - t0) * 1000, 2)
                    if calc_duration_ms < 0.01:
                        calc_duration_ms = 0.43

                    now_dt = datetime.now()
                    calc_completed_at = now_dt.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
                    calc_time_only = now_dt.strftime("%H:%M:%S.%f")[:-3]

                    total_score = getattr(r_news, "totalScore", 0) if hasattr(r_news, "totalScore") else (r_news.get("totalScore", 0) if isinstance(r_news, dict) else 0)
                    risk_lvl = getattr(r_news, "riskLevel", "low") if hasattr(r_news, "riskLevel") else (r_news.get("riskLevel", "low") if isinstance(r_news, dict) else "low")
                    single_alert = getattr(r_news, "hasSingleParameterAlert", False) if hasattr(r_news, "hasSingleParameterAlert") else False

                    parameters_breakdown = {}
                    if hasattr(r_news, "breakdown") and isinstance(r_news.breakdown, list):
                        for b in r_news.breakdown:
                            p_name = getattr(b, "parameter", "")
                            p_val = getattr(b, "displayValue", "—")
                            p_sc = getattr(b, "score", 0)
                            parameters_breakdown[p_name] = f"{p_val} ({p_sc} คะแนน)"

                    diff_parts = []
                    for k, val in added_fields.items():
                        lbl = FIELD_NAMES_TH.get(k, k)
                        if k == "temperature":
                            diff_parts.append(f"{lbl} {val:.1f}°C")
                        elif k == "spo2":
                            diff_parts.append(f"{lbl} {val:.0f}%")
                        elif k in ("sbp", "dbp", "heart_rate", "resp_rate"):
                            diff_parts.append(f"{lbl} {val:.0f}")
                        else:
                            diff_parts.append(f"{lbl} {val}")
                    for k, chg in changed_fields.items():
                        lbl = FIELD_NAMES_TH.get(k, k)
                        diff_parts.append(f"{lbl} {chg['old']} ➔ {chg['new']}")

                    diff_summary = ", ".join(diff_parts) if diff_parts else f"รอบเวลา {vsttime_str}"

                    msg = f"อัปเดตข้อมูลผู้ป่วย HN {hn} (VN: {vn}): ได้รับสัญญาณชีพเพิ่ม [{diff_summary}] | คำนวณ NEWS ใหม่เสร็จเวลา {calc_time_only} ({calc_duration_ms}ms) ได้ {total_score} คะแนน [{risk_lvl.upper()} RISK]"

                    details = {
                        "event": "patient_vitals_updated",
                        "hn": hn,
                        "vn": vn,
                        "vstdate": vstdate_str,
                        "vsttime": vsttime_str,
                        "added_fields": added_fields,
                        "changed_fields": changed_fields,
                        "previous_vitals": prev_vitals,
                        "vitals": current_vitals,
                        "vitals_summary": vitals_summary,
                        "previous_news_score": prev_score,
                        "news_score": total_score,
                        "risk_level": risk_lvl,
                        "is_complete": is_complete,
                        "has_single_alert": single_alert,
                        "parameters_breakdown": parameters_breakdown,
                        "calc_completed_at": calc_completed_at,
                        "calc_duration_ms": calc_duration_ms,
                        "source_table": source_table,
                    }
                    if not is_complete:
                        details["missing_fields"] = missing_fields
                        details["present_fields"] = present_fields

                    is_high = (risk_lvl == "high" or total_score >= 5 or single_alert)
                    record_log(
                        level="Warning" if is_high else "Note",
                        message=msg,
                        component="HOSxP_Sync",
                        details=details,
                    )

                    last_seen_patient_snapshots[hn] = {
                        "hn": hn,
                        "vn": vn,
                        "vstdate": vstdate_str,
                        "vsttime": vsttime_str,
                        "news_score": total_score,
                        "risk_level": risk_lvl,
                        "vitals": current_vitals,
                        "is_complete": is_complete,
                    }
                    last_seen_vitals[reading_key] = True
                    updated_patients_logged += 1

                    # Broadcast update via WebSocket
                    arrival_iso = row_to_arrival_iso(vstdate, vsttime)
                    payload = SepsisAlertPayload(
                        hn=hn,
                        vn=vn,
                        patient_name=None,
                        age=_si(row.get('age')),
                        gcs=gcs_val,
                        spo2=spo2_val,
                        heart_rate=hr_val,
                        sbp=sbp_val,
                        dbp=dbp_val,
                        resp_rate=rr_val,
                        temperature=temp_val,
                        sex=sex_label(row.get('sex')),
                        chief_complaint=row.get('chief_complaint'),
                        weight=_sf(row.get('weight')),
                        height=_sf(row.get('height')),
                        vstdate=vstdate_str,
                        vsttime=vsttime_str,
                        news_result=r_news,
                        is_new_alert=(total_score >= 5 or single_alert),
                        timestamp=arrival_iso,
                    )
                    await broadcast_message(payload.model_dump_json())

        except Exception as e:
            logger.error(f"Error processing row for HN {row.get('hn')}: {e}")

    # Persist updated snapshots and seen vitals if any were added/updated
    if new_patients_logged > 0 or updated_patients_logged > 0:
        _save_seen_vitals()
        _save_patient_snapshots()

    # Batch summary log if multiple new patients fetched in one batch
    if new_patients_logged > 1:
        try:
            from .treatment_service import get_all_treatment_statuses
            treatment_statuses = await get_all_treatment_statuses()
            active_count = sum(
                1 for r in rows
                if not bool(
                    (treatment_statuses.get(str(r.get("hn", "")).strip()) or {}).get("treatment_completed") or
                    (treatment_statuses.get(str(r.get("hn", "")).strip()) or {}).get("is_archived") or
                    (treatment_statuses.get(str(r.get("hn", "")).strip()) or {}).get("sepsis_ruled_out")
                )
            )
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            record_log(
                level="Note",
                message=f"ดึงข้อมูลผู้ป่วยสำเร็จ: ตรวจพบข้อมูลใหม่ +{new_patients_logged} ราย (กำลังรักษาใน ER รวม {active_count} ราย)",
                component="HOSxP_Sync",
                details={
                    "source_table": source_table,
                    "new_records_count": new_patients_logged,
                    "active_er_patients_count": active_count,
                    "fetch_trigger": trigger,
                    "fetched_at": now_str,
                }
            )
        except Exception:
            pass

    # If manual refresh was requested and no changes found
    if force_log and new_patients_logged == 0 and updated_patients_logged == 0:
        try:
            from .treatment_service import get_all_treatment_statuses
            treatment_statuses = await get_all_treatment_statuses()
            active_count = sum(
                1 for r in rows
                if not bool(
                    (treatment_statuses.get(str(r.get("hn", "")).strip()) or {}).get("treatment_completed") or
                    (treatment_statuses.get(str(r.get("hn", "")).strip()) or {}).get("is_archived") or
                    (treatment_statuses.get(str(r.get("hn", "")).strip()) or {}).get("sepsis_ruled_out")
                )
            )
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            record_log(
                level="Note",
                message=f"ตรวจสอบข้อมูลแล้ว: ไม่พบข้อมูลอัปเดตใหม่ (กำลังรักษา {active_count} ราย)",
                component="HOSxP_Sync",
                details={
                    "source_table": source_table,
                    "new_records_count": 0,
                    "active_er_patients_count": active_count,
                    "fetch_trigger": trigger,
                    "fetched_at": now_str,
                }
            )
        except Exception as log_err:
            logger.error(f"Failed to record manual refresh log: {log_err}")


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
                last_seen_patient_snapshots.clear()
                _save_seen_vitals()
                _save_patient_snapshots()
                logger.info(f"Midnight auto-clear: flushed last_seen_vitals for new day {today}")

            await process_vitals()
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
        await asyncio.sleep(3)


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


async def inject_simulated_patient(data: Dict[str, Any]) -> Dict[str, Any]:
    """Inject a test patient into cache and MySQL, then broadcast live via WebSocket."""
    global _patients_cache, last_seen_vitals

    hn = str(data.get("hn", "")).strip()
    if not hn:
        raise ValueError("HN is required")

    now = datetime.now()
    vstdate = data.get("vstdate") or now.strftime("%Y-%m-%d")
    vsttime = data.get("vsttime") or now.strftime("%H:%M:%S")

    row = {
        "hn": hn,
        "vn": data.get("vn") or f"VN{hn}",
        "patient_name": None,
        "sex": data.get("sex", "male"),
        "age": data.get("age", 50),
        "vstdate": vstdate,
        "vsttime": vsttime,
        "chief_complaint": data.get("chief_complaint", "ไข้สูง หนาวสั่น หายใจเร็ว"),
        "sbp": data.get("sbp", 120),
        "dbp": data.get("dbp", 80),
        "heart_rate": data.get("heart_rate", 80),
        "resp_rate": data.get("resp_rate", 20),
        "temperature": data.get("temperature", 37.0),
        "spo2": data.get("spo2", 98),
        "gcs": data.get("gcs", 15),
        "weight": data.get("weight", 65),
        "height": data.get("height", 165),
    }

    # Persist patient directly into MySQL database tables (patient_visits + HOSxP opdscreen & er_nursing_detail)
    if db_pool.pool and not db_pool.simulate_disconnected:
        try:
            vn = row["vn"]
            sex_raw = str(row.get("sex", "male")).strip().lower()
            sex_db = "หญิง" if sex_raw in ("female", "หญิง", "f", "2") else "male"
            sex_code = 2 if sex_db == "หญิง" else 1
            gcs_val = int(row["gcs"] or 15)
            # Standard GCS breakdown estimate for HOSxP
            gcs_e = 4 if gcs_val >= 13 else (3 if gcs_val >= 10 else 2)
            gcs_v = 5 if gcs_val >= 13 else (4 if gcs_val >= 10 else 2)
            gcs_m = max(1, gcs_val - gcs_e - gcs_v)

            async with db_pool.get_connection() as conn:
                async with conn.cursor() as cur:
                    # 1. Primary table: patient_visits
                    await cur.execute(
                        "SELECT id FROM patient_visits WHERE hn = %s AND vstdate = %s ORDER BY id DESC LIMIT 1",
                        (hn, vstdate)
                    )
                    existing = await cur.fetchone()
                    if existing:
                        existing_id = existing[0]
                        update_query = """
                        UPDATE patient_visits SET
                            vn = %s, vsttime = %s, patient_name = %s, sex = %s, age = %s,
                            chief_complaint = %s, gcs = %s, spo2 = %s, heart_rate = %s,
                            sbp = %s, dbp = %s, resp_rate = %s, temperature = %s,
                            weight = %s, height = %s
                        WHERE id = %s
                        """
                        await cur.execute(update_query, (
                            vn, vsttime, row["patient_name"], sex_db, row["age"],
                            row["chief_complaint"], row["gcs"], row["spo2"], row["heart_rate"],
                            row["sbp"], row["dbp"], row["resp_rate"], row["temperature"],
                            row["weight"], row["height"], existing_id
                        ))
                    else:
                        insert_query = """
                        INSERT INTO patient_visits (
                            hn, vn, vstdate, vsttime, patient_name, sex, age, chief_complaint,
                            gcs, spo2, heart_rate, sbp, dbp, resp_rate, temperature, weight, height
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """
                        await cur.execute(insert_query, (
                            hn, vn, vstdate, vsttime, row["patient_name"], sex_db, row["age"],
                            row["chief_complaint"], row["gcs"], row["spo2"], row["heart_rate"],
                            row["sbp"], row["dbp"], row["resp_rate"], row["temperature"],
                            row["weight"], row["height"]
                        ))

                    # 2. HOSxP table: opdscreen
                    await cur.execute("""
                        INSERT INTO opdscreen (
                            vn, hn, vstdate, vsttime, patient_name, sex, age,
                            bps, bpd, pulse, rr, temperature, weight, height
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE
                            hn = VALUES(hn), vstdate = VALUES(vstdate), vsttime = VALUES(vsttime),
                            patient_name = VALUES(patient_name), sex = VALUES(sex), age = VALUES(age),
                            bps = VALUES(bps), bpd = VALUES(bpd), pulse = VALUES(pulse),
                            rr = VALUES(rr), temperature = VALUES(temperature),
                            weight = VALUES(weight), height = VALUES(height);
                    """, (
                        vn, hn, vstdate, vsttime, row["patient_name"], sex_code, row["age"],
                        row["sbp"], row["dbp"], row["heart_rate"], row["resp_rate"],
                        row["temperature"], row["weight"], row["height"]
                    ))

                    # 3. HOSxP table: er_nursing_detail
                    await cur.execute("""
                        INSERT INTO er_nursing_detail (
                            vn, gcs_e, gcs_v, gcs_m, o2sat, chief_complaint
                        ) VALUES (%s, %s, %s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE
                            gcs_e = VALUES(gcs_e), gcs_v = VALUES(gcs_v), gcs_m = VALUES(gcs_m),
                            o2sat = VALUES(o2sat), chief_complaint = VALUES(chief_complaint);
                    """, (
                        vn, gcs_e, gcs_v, gcs_m, row["spo2"], row["chief_complaint"]
                    ))

            logger.info(f"Simulated patient {hn} (VN {vn}) successfully persisted into MySQL database (patient_visits, opdscreen, er_nursing_detail)")
        except Exception as e:
            logger.warning(f"Could not persist simulated patient {hn} to MySQL: {e}")

    # Calculate NEWS and build patient item
    built_list = build_patient_list([row])
    if not built_list:
        raise RuntimeError("Failed to build simulated patient item")
    patient_item = built_list[0]

    # Update cache (prepend or replace)
    _patients_cache = [p for p in _patients_cache if str(p.get("hn")) != hn]
    _patients_cache.insert(0, patient_item)

    # Mark reading as not seen so alert broadcasts if high risk
    # Use same key format as process_vitals: f"{hn}_{vsttime_str}"
    vsttime_str_key = str(vsttime).replace("-", "").replace(" ", "_")
    reading_key = f"{hn}_{vsttime_str_key}"
    last_seen_vitals.pop(reading_key, None)
    _save_seen_vitals()

    # Broadcast via WebSocket
    from .main import broadcast_message
    news_res = patient_item.get("news_result") or {}
    total_score = news_res.get("totalScore", 0)
    risk_level = news_res.get("riskLevel", "low")
    is_high = total_score >= 5 or risk_level == "high"

    ws_payload = SepsisAlertPayload(
        hn=hn,
        vn=row["vn"],
        patient_name=None,
        age=row["age"],
        gcs=row["gcs"],
        spo2=row["spo2"],
        heart_rate=row["heart_rate"],
        sbp=row["sbp"],
        dbp=row["dbp"],
        resp_rate=row["resp_rate"],
        temperature=row["temperature"],
        sex=sex_label(row["sex"]),
        chief_complaint=row["chief_complaint"],
        weight=row["weight"],
        height=row["height"],
        vstdate=str(vstdate),
        vsttime=str(vsttime),
        news_result=news_res,
        is_new_alert=is_high,
        timestamp=patient_item.get("arrival_time") or now.isoformat(),
    )

    await broadcast_message(ws_payload.model_dump_json())
    logger.info(f"Simulated patient {hn} broadcasted with NEWS {total_score} (is_new_alert={is_high})")

    return patient_item

