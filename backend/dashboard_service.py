import logging
from datetime import datetime, date, time
from typing import Dict, Any, List, Optional
from .database import db_pool
from .services import calculate_news_from_row, format_time_str

logger = logging.getLogger(__name__)

def mask_hn_last_4(hn: str) -> str:
    """Mask HN keeping only the last 4 digits for PDPA compliance."""
    if not hn:
        return "HN****"
    digits = "".join(c for c in hn if c.isdigit())
    if len(digits) <= 4:
        return f"HN****{digits}"
    return f"HN****{digits[-4:]}"

def format_gender(sex_val: Any) -> str:
    s = str(sex_val).strip().lower()
    if s in ("1", "ชาย", "male", "m"):
        return "ชาย"
    if s in ("2", "หญิง", "female", "f"):
        return "หญิง"
    return "ไม่ระบุ"

async def get_daily_dashboard_stats() -> Dict[str, Any]:
    """
    Query MySQL sepsis_db to calculate daily statistics:
    - Total cases
    - High-risk sepsis cases (NEWS >= 5 or single parameter alert)
    - Treated completed (Sepsis Bundle done)
    - Sepsis ruled out
    - Active treating
    - Bundle compliance rate (%)
    """
    async with db_pool.get_connection() as conn:
        cur = await conn.cursor()
        # 1. Fetch available visit dates (latest 14 distinct dates)
        await cur.execute(
            "SELECT DISTINCT DATE(vstdate) as d FROM patient_visits ORDER BY d DESC LIMIT 14"
        )
        date_rows = await cur.fetchall()
        dates = [row[0].strftime("%Y-%m-%d") for row in date_rows if row[0]]

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

        # 2. Fetch all treatment statuses
        await cur.execute(
            "SELECT hn, acknowledged, doctor_confirmed, treatment_completed, sepsis_ruled_out, "
            "treatment_completed_at, treatment_completed_by FROM patient_treatment_status"
        )
        t_rows = await cur.fetchall()
        treatment_map: Dict[str, Dict[str, Any]] = {}
        for r in t_rows:
            treatment_map[str(r[0])] = {
                "hn": str(r[0]),
                "acknowledged": bool(r[1]),
                "doctor_confirmed": bool(r[2]),
                "treatment_completed": bool(r[3]),
                "sepsis_ruled_out": bool(r[4]),
                "treatment_completed_at": r[5].isoformat() if r[5] else None,
                "treatment_completed_by": r[6],
            }

        daily_history: List[Dict[str, Any]] = []

        for d_str in dates:
            await cur.execute(
                "SELECT vn, hn, vstdate, vsttime, sex, age, heart_rate, sbp, dbp, resp_rate, temperature, spo2, gcs "
                "FROM patient_visits WHERE DATE(vstdate) = %s",
                (d_str,)
            )
            v_rows = await cur.fetchall()

            total_cases = len(v_rows)
            high_risk_cases = 0
            treated_completed = 0
            ruled_out = 0
            active_treating = 0

            for row in v_rows:
                hn = str(row[1])
                row_dict = {
                    "vn": row[0],
                    "hn": hn,
                    "vstdate": row[2],
                    "vsttime": row[3],
                    "sex": row[4],
                    "age": row[5],
                    "heart_rate": row[6],
                    "sbp": row[7],
                    "dbp": row[8],
                    "resp_rate": row[9],
                    "temperature": row[10],
                    "spo2": row[11],
                    "gcs": row[12],
                }

                news = calculate_news_from_row(row_dict)
                is_high_risk = news.totalScore >= 5 or news.hasSingleParameterAlert
                if is_high_risk:
                    high_risk_cases += 1

                t_status = treatment_map.get(hn)
                if t_status:
                    if t_status["treatment_completed"]:
                        treated_completed += 1
                    elif t_status["sepsis_ruled_out"]:
                        ruled_out += 1
                    elif t_status["acknowledged"]:
                        active_treating += 1

            # Compliance rate: completed / high_risk * 100
            if high_risk_cases > 0:
                compliance_rate = round((treated_completed / high_risk_cases) * 100, 1)
            else:
                compliance_rate = 100.0 if total_cases > 0 else 0.0

            daily_history.append({
                "date": d_str,
                "total_cases": total_cases,
                "high_risk_cases": high_risk_cases,
                "treated_completed": treated_completed,
                "ruled_out": ruled_out,
                "active_treating": active_treating,
                "compliance_rate": compliance_rate,
            })

        summary_today = daily_history[0] if daily_history else {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "total_cases": 0,
            "high_risk_cases": 0,
            "treated_completed": 0,
            "ruled_out": 0,
            "active_treating": 0,
            "compliance_rate": 0.0,
        }

        return {
            "dates": dates,
            "summary_today": summary_today,
            "daily_history": daily_history,
        }


async def get_daily_treated_cases(target_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetch patient cases for the specified date (or latest date).
    Strictly masks HN to 4 digits and excludes patient names, IDs, addresses for PDPA compliance.
    """
    async with db_pool.get_connection() as conn:
        cur = await conn.cursor()

        if not target_date:
            await cur.execute("SELECT MAX(DATE(vstdate)) FROM patient_visits")
            max_d = await cur.fetchone()
            if max_d and max_d[0]:
                target_date = max_d[0].strftime("%Y-%m-%d")
            else:
                target_date = datetime.now().strftime("%Y-%m-%d")

        # Fetch visits for target_date
        await cur.execute(
            "SELECT vn, hn, vstdate, vsttime, sex, age, heart_rate, sbp, dbp, resp_rate, temperature, spo2, gcs "
            "FROM patient_visits WHERE DATE(vstdate) = %s ORDER BY vsttime DESC",
            (target_date,)
        )
        v_rows = await cur.fetchall()

        # Fetch treatment statuses
        await cur.execute(
            "SELECT hn, acknowledged, doctor_confirmed, treatment_completed, sepsis_ruled_out, "
            "treatment_completed_at, treatment_completed_by, acknowledged_at, acknowledged_by "
            "FROM patient_treatment_status"
        )
        t_rows = await cur.fetchall()
        treatment_map: Dict[str, Dict[str, Any]] = {}
        for r in t_rows:
            treatment_map[str(r[0])] = {
                "hn": str(r[0]),
                "acknowledged": bool(r[1]),
                "doctor_confirmed": bool(r[2]),
                "treatment_completed": bool(r[3]),
                "sepsis_ruled_out": bool(r[4]),
                "treatment_completed_at": r[5].isoformat() if r[5] else None,
                "treatment_completed_by": r[6],
                "acknowledged_at": r[7].isoformat() if r[7] else None,
                "acknowledged_by": r[8],
            }

        cases: List[Dict[str, Any]] = []

        for row in v_rows:
            hn = str(row[1])
            row_dict = {
                "vn": row[0],
                "hn": hn,
                "vstdate": row[2],
                "vsttime": row[3],
                "sex": row[4],
                "age": row[5],
                "heart_rate": row[6],
                "sbp": row[7],
                "dbp": row[8],
                "resp_rate": row[9],
                "temperature": row[10],
                "spo2": row[11],
                "gcs": row[12],
            }

            news = calculate_news_from_row(row_dict)
            t_status = treatment_map.get(hn)

            # Format vsttime safely
            time_str = format_time_str(row[3])[:5] if row[3] is not None else "--:--"

            is_treated = False
            is_ruled_out = False
            is_completed = False
            outcome_label = "ปกติ"
            completed_time = None
            staff = None

            if t_status:
                is_completed = t_status["treatment_completed"]
                is_ruled_out = t_status["sepsis_ruled_out"]
                completed_time = t_status["treatment_completed_at"]
                staff = t_status["treatment_completed_by"] or t_status["acknowledged_by"]

                if is_completed:
                    is_treated = True
                    outcome_label = "✅ Sepsis Bundle สำเร็จ"
                elif is_ruled_out:
                    is_treated = True
                    outcome_label = "🟢 Rule Out Sepsis"
                elif t_status["acknowledged"]:
                    outcome_label = "⏳ กำลังดูแลรักษา"
                elif news.totalScore >= 5 or news.hasSingleParameterAlert:
                    outcome_label = "🔴 เสี่ยงสูง (รอรับทราบ)"
            else:
                if news.totalScore >= 5 or news.hasSingleParameterAlert:
                    outcome_label = "🔴 เสี่ยงสูง (รอประเมิน)"

            cases.append({
                "id": hn,
                "masked_hn": mask_hn_last_4(hn),
                "gender": format_gender(row[4]),
                "age": row[5] or 0,
                "news_score": news.totalScore,
                "risk_level": news.riskLevel,
                "has_single_alert": news.hasSingleParameterAlert,
                "arrival_date": str(row[2]),
                "arrival_time": time_str,
                "is_treated": is_treated,
                "treatment_completed": is_completed,
                "sepsis_ruled_out": is_ruled_out,
                "treatment_completed_at": completed_time,
                "treated_by": staff or "ทีมแพทย์/พยาบาล ER",
                "outcome_label": outcome_label,
            })

        return cases
