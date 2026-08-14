from typing import Optional, Dict, Any
from datetime import datetime, date, time
from .schemas import NEWSResult, NEWSParameterScore


# ---------------------------------------------------------------------------
# NEWS Scoring Functions (NEWS2 standard)
# ---------------------------------------------------------------------------

def score_rr(rr: float) -> int:
    if rr <= 8: return 3
    if rr <= 11: return 1
    if rr <= 20: return 0
    if rr <= 24: return 2
    return 3


def score_spo2(spo2: float) -> int:
    if spo2 <= 91: return 3
    if spo2 <= 93: return 2
    if spo2 <= 95: return 1
    return 0


def score_temp(temp: float) -> int:
    if temp <= 35.0: return 3
    if temp <= 36.0: return 1
    if temp <= 38.0: return 0
    if temp <= 39.0: return 1
    return 2


def score_sbp(sbp: float) -> int:
    if sbp <= 90: return 3
    if sbp <= 100: return 2
    if sbp <= 110: return 1
    if sbp <= 219: return 0
    return 3


def score_hr(hr: float) -> int:
    if hr <= 40: return 3
    if hr <= 50: return 1
    if hr <= 90: return 0
    if hr <= 110: return 1
    if hr <= 130: return 2
    return 3


def score_avpu(gcs: Optional[int]) -> int:
    """Approximate AVPU from GCS. GCS 15 → Alert (0). GCS < 15 → non-Alert (3)."""
    if gcs is None:
        return 0  # Default if missing
    return 0 if gcs >= 15 else 3


# ---------------------------------------------------------------------------
# Main NEWS Calculation (accepts a plain dict from DB row)
# ---------------------------------------------------------------------------

def calculate_news_from_row(row: Dict[str, Any]) -> NEWSResult:
    """
    Calculate NEWS score from a DB row dict.
    Works with both patient_visits and opdscreen column names.
    """
    gcs = _safe_int(row.get('gcs'))
    spo2 = _safe_float(row.get('spo2'))
    heart_rate = _safe_float(row.get('heart_rate') or row.get('pulse'))
    sbp = _safe_float(row.get('sbp') or row.get('bps'))
    resp_rate = _safe_float(row.get('resp_rate') or row.get('rr'))
    temperature = _safe_float(row.get('temperature'))

    breakdown = []
    total_score = 0
    missing_data_count = 0
    has_single_alert = False

    def process_param(param_name: str, label: str, value: Optional[float], score_fn, format_str: str):
        nonlocal total_score, missing_data_count, has_single_alert

        if value is None:
            missing_data_count += 1
            breakdown.append(NEWSParameterScore(
                parameter=param_name,
                label=label,
                displayValue="—",
                score=0,
                isAbnormal=False,
                isCritical=False
            ))
            return

        score = score_fn(value)
        total_score += score
        is_critical = score == 3
        if is_critical:
            has_single_alert = True

        breakdown.append(NEWSParameterScore(
            parameter=param_name,
            label=label,
            displayValue=format_str.format(value),
            score=score,
            isAbnormal=score >= 1,
            isCritical=is_critical
        ))

    process_param("respiratoryRate", "Respiratory Rate", resp_rate, score_rr, "{:.0f} bpm")
    process_param("spO2", "SpO₂", spo2, score_spo2, "{:.0f}%")
    process_param("temperature", "Temperature", temperature, score_temp, "{:.1f}°C")
    process_param("systolicBP", "Systolic BP", sbp, score_sbp, "{:.0f} mmHg")
    process_param("heartRate", "Heart Rate", heart_rate, score_hr, "{:.0f} bpm")

    # AVPU from GCS
    if gcs is None:
        missing_data_count += 1
        breakdown.append(NEWSParameterScore(
            parameter="avpu", label="Consciousness (GCS)", displayValue="—",
            score=0, isAbnormal=False, isCritical=False
        ))
    else:
        avpu_score = score_avpu(gcs)
        total_score += avpu_score
        if avpu_score == 3:
            has_single_alert = True
        breakdown.append(NEWSParameterScore(
            parameter="avpu", label="Consciousness (GCS)", displayValue=str(gcs),
            score=avpu_score, isAbnormal=avpu_score >= 1, isCritical=avpu_score == 3
        ))

    # Risk classification
    if total_score >= 7:
        risk_level = "high"
    elif total_score >= 5:
        risk_level = "medium"
    elif has_single_alert:
        risk_level = "low_medium"
    else:
        risk_level = "low"

    return NEWSResult(
        totalScore=total_score,
        breakdown=breakdown,
        riskLevel=risk_level,
        hasSingleParameterAlert=has_single_alert,
        missingDataCount=missing_data_count,
        calculatedAt=datetime.now().isoformat()
    )


def row_to_arrival_iso(vstdate, vsttime) -> str:
    """Convert DB vstdate + vsttime into an ISO 8601 timestamp string."""
    try:
        if isinstance(vstdate, date):
            d = vstdate
        else:
            d = date.fromisoformat(str(vstdate))

        if isinstance(vsttime, time):
            t = vsttime
        elif isinstance(vsttime, str):
            # Could be 'HH:MM:SS' or 'HHMM'
            parts = vsttime.strip().split(':')
            if len(parts) >= 2:
                t = time(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
            else:
                t = time(0, 0, 0)
        else:
            t = time(0, 0, 0)

        return datetime.combine(d, t).isoformat()
    except Exception:
        return datetime.now().isoformat()


def sex_label(sex_val) -> Optional[str]:
    """Normalize sex field to 'male'/'female'/'other'."""
    if sex_val is None:
        return None
    sv = str(sex_val).strip().lower()
    if sv in ('1', 'male', 'm', 'ชาย'):
        return 'male'
    if sv in ('2', 'female', 'f', 'หญิง'):
        return 'female'
    return 'other'


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _safe_int(val) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None
