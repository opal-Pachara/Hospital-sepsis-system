from typing import Optional, Dict, Any
from datetime import datetime, date, time, timedelta
from .schemas import NEWSResult, NEWSParameterScore


# ---------------------------------------------------------------------------
# NEWS Scoring Functions (NEWS 2012 standard — Royal College of Physicians)
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


def score_oxygen(supplemental: bool) -> int:
    """Supplemental Oxygen scoring. Room Air → 0, Supplemental O2 → 2."""
    return 2 if supplemental else 0


# ---------------------------------------------------------------------------
# Main NEWS Calculation (accepts a plain dict from DB row)
# ---------------------------------------------------------------------------

def calculate_news_from_row(row: Dict[str, Any]) -> NEWSResult:
    """
    Calculate NEWS 2012 score from a DB row dict.
    Works with both patient_visits and opdscreen column names.
    Supports NEWS 2012 rules:
    - GCS = 15 -> automatically Alert (A = 0 points).
    - GCS < 15 -> requires AVPU assessment (A = 0, V/P/U = 3); if other vitals >= 5, alert immediately.
    - Supplemental Oxygen -> unassessed unless specified; if unassessed:
      0-2 points -> low risk (no prompt, isComplete=False)
      3-4 points -> incomplete (needsOxygenPrompt=True, isComplete=False)
      >= 5 points -> high risk alert immediately (isComplete=False)
    """
    gcs = _safe_int(row.get('gcs'))
    spo2 = _safe_float(row.get('spo2') or row.get('o2sat'))
    heart_rate = _safe_float(row.get('heart_rate') or row.get('pulse'))
    sbp = _safe_float(row.get('sbp') or row.get('bps'))
    resp_rate = _safe_float(row.get('resp_rate') or row.get('rr'))
    temperature = _safe_float(row.get('temperature'))

    # Supplemental Oxygen (None/'unassessed' = not yet specified, 0/False/'room_air' = 0, 1/True/'supplemental' = 2)
    raw_supp_o2 = row.get('supplemental_oxygen')
    raw_o2_str = row.get('oxygenSupplementation')
    is_oxygen_assessed = not (raw_supp_o2 is None and raw_o2_str in (None, 'unassessed'))
    is_supplemental = bool(
        is_oxygen_assessed and (
            raw_supp_o2 in (1, True, 'supplemental') or
            raw_o2_str == 'supplemental'
        )
    )

    # AVPU assessment status
    assessed_avpu = row.get('assessed_avpu') or row.get('avpu')
    avpu_status = row.get('avpu_status')

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

    # Add Oxygen Supplementation parameter
    o2_score = score_oxygen(is_supplemental) if is_oxygen_assessed else 0
    total_score += o2_score
    o2_display = (
        "ยังไม่ระบุ (รอเลือก)"
        if not is_oxygen_assessed
        else ("Supplemental O₂" if is_supplemental else "Room Air")
    )
    breakdown.append(NEWSParameterScore(
        parameter="oxygenSupplementation",
        label="Oxygen Supplementation",
        displayValue=o2_display,
        score=o2_score,
        isAbnormal=is_supplemental,
        isCritical=False
    ))

    # Evaluate AVPU Confirmation (NEWS 2012 Rule 1: GCS == 15 -> auto A=0; GCS < 15 -> requires AVPU assessment)
    is_avpu_confirmed = False
    chosen_avpu = None

    if assessed_avpu in ['A', 'V', 'P', 'U']:
        is_avpu_confirmed = True
        chosen_avpu = assessed_avpu
    elif gcs == 15 or avpu_status == 'confirmed_alert':
        is_avpu_confirmed = True
        chosen_avpu = 'A'

    if gcs is None:
        missing_data_count += 1
        breakdown.append(NEWSParameterScore(
            parameter="avpu", label="Consciousness (GCS)", displayValue="—",
            score=0, isAbnormal=False, isCritical=False
        ))
    elif is_avpu_confirmed:
        avpu_score = 0 if chosen_avpu == 'A' else 3
        total_score += avpu_score
        is_critical = (avpu_score == 3)
        if is_critical:
            has_single_alert = True
        breakdown.append(NEWSParameterScore(
            parameter="avpu",
            label="Consciousness (AVPU)",
            displayValue=f"GCS {gcs} ({chosen_avpu})",
            score=avpu_score,
            isAbnormal=(avpu_score >= 1),
            isCritical=is_critical
        ))
    else:
        # GCS < 15 and nurse hasn't assessed AVPU yet
        display_label = f"GCS {gcs} (รอประเมิน AVPU)"
        breakdown.append(NEWSParameterScore(
            parameter="avpu",
            label="Consciousness (AVPU)",
            displayValue=display_label,
            score=0,
            isAbnormal=False,
            isCritical=False
        ))

    # Check clinical completeness of vital signs
    missing_params = []
    if resp_rate is None: missing_params.append("อัตราการหายใจ (RR)")
    if spo2 is None: missing_params.append("ความอิ่มตัวออกซิเจน (SpO2)")
    if temperature is None: missing_params.append("อุณหภูมิร่างกาย (BT)")
    if sbp is None: missing_params.append("ความดันโลหิต (SBP)")
    if heart_rate is None: missing_params.append("ชีพจร (HR)")
    if gcs is None: missing_params.append("ระดับความรู้สึกตัว (GCS)")

    # If any fundamental vital parameter is totally missing from DB
    if len(missing_params) > 0:
        return NEWSResult(
            totalScore=0,
            breakdown=breakdown,
            riskLevel="incomplete",
            hasSingleParameterAlert=False,
            missingDataCount=len(missing_params),
            calculatedAt="",
            isComplete=False,
            missingParameters=missing_params,
            needsAvpuPrompt=False,
            needsOxygenPrompt=False,
        )

    calc_now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

    # Rule 4: If GCS < 15 and AVPU is not yet assessed
    if not is_avpu_confirmed:
        pending_missing = ["รอประเมิน AVPU (GCS < 15)"]
        if not is_oxygen_assessed:
            pending_missing.append("ยังไม่ระบุการได้รับออกซิเจนเสริม")

        # Safety First: If known parameters already sum to >= 5 -> alert immediately without waiting for AVPU
        if total_score >= 5:
            return NEWSResult(
                totalScore=total_score,
                breakdown=breakdown,
                riskLevel="high",
                hasSingleParameterAlert=True,
                missingDataCount=len(pending_missing),
                calculatedAt=calc_now_str,
                isComplete=False,
                missingParameters=pending_missing,
                needsAvpuPrompt=False,
                needsOxygenPrompt=False,
            )
        else:
            # Known parameters < 5: prompt nurse to assess AVPU first
            return NEWSResult(
                totalScore=total_score,
                breakdown=breakdown,
                riskLevel="incomplete",
                hasSingleParameterAlert=has_single_alert,
                missingDataCount=len(pending_missing),
                calculatedAt="",
                isComplete=False,
                missingParameters=pending_missing,
                needsAvpuPrompt=True,
                needsOxygenPrompt=not is_oxygen_assessed and (total_score in (3, 4)),
            )

    # Rule 3: All other parameters (including AVPU) are known, except Supplemental Oxygen
    if not is_oxygen_assessed:
        if total_score >= 5:
            # >= 5 points: Alert immediately without waiting for O2
            return NEWSResult(
                totalScore=total_score,
                breakdown=breakdown,
                riskLevel="high",
                hasSingleParameterAlert=True,
                missingDataCount=1,
                calculatedAt=calc_now_str,
                isComplete=False,
                missingParameters=["ยังไม่ระบุการได้รับออกซิเจนเสริม"],
                needsAvpuPrompt=False,
                needsOxygenPrompt=False,
            )
        elif total_score in (3, 4):
            # 3-4 points: Require nurse to specify O2 before concluding (since +2 O2 reaches >= 5)
            return NEWSResult(
                totalScore=total_score,
                breakdown=breakdown,
                riskLevel="incomplete",
                hasSingleParameterAlert=has_single_alert,
                missingDataCount=1,
                calculatedAt="",
                isComplete=False,
                missingParameters=["ยังไม่ระบุการได้รับออกซิเจนเสริม (คะแนนเบื้องต้น 3–4 คะแนน)"],
                needsAvpuPrompt=False,
                needsOxygenPrompt=True,
            )
        else:
            # 0-2 points: Do not alert/prompt (even +2 O2 is <= 4 < 5), but mark score as incomplete
            return NEWSResult(
                totalScore=total_score,
                breakdown=breakdown,
                riskLevel="low",
                hasSingleParameterAlert=has_single_alert,
                missingDataCount=0,
                calculatedAt=calc_now_str,
                isComplete=False,
                missingParameters=["ยังไม่ระบุการได้รับออกซิเจนเสริม"],
                needsAvpuPrompt=False,
                needsOxygenPrompt=False,
            )

    # Risk classification for fully confirmed & complete vitals (including O2)
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
        missingDataCount=0,
        calculatedAt=calc_now_str,
        isComplete=True,
        missingParameters=[],
        needsAvpuPrompt=False,
        needsOxygenPrompt=False,
    )


def parse_db_date(vstdate) -> date:
    """Safely parse various DB vstdate representations into a date object."""
    if isinstance(vstdate, datetime):
        return vstdate.date()
    if isinstance(vstdate, date):
        return vstdate
    if isinstance(vstdate, str):
        cleaned = vstdate.strip().replace('/', '-')
        try:
            return date.fromisoformat(cleaned)
        except Exception:
            pass
    return date.today()


def parse_db_time(vsttime) -> time:
    """Safely parse various DB vsttime representations (time, timedelta, str) into a time object."""
    if isinstance(vsttime, time):
        return vsttime

    # aiomysql/PyMySQL returns timedelta for MySQL TIME columns
    if isinstance(vsttime, timedelta):
        total_seconds = int(vsttime.total_seconds())
        hours = (total_seconds // 3600) % 24
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        return time(hours, minutes, seconds)

    if isinstance(vsttime, str):
        cleaned = vsttime.strip()
        if ':' in cleaned:
            parts = cleaned.split(':')
            try:
                h = int(parts[0])
                m = int(parts[1]) if len(parts) > 1 else 0
                s = int(parts[2]) if len(parts) > 2 else 0
                return time(h, m, s)
            except (ValueError, TypeError):
                return time(0, 0, 0)
        # HOSxP format HHMM or HHMMSS
        if len(cleaned) == 4 and cleaned.isdigit():
            return time(int(cleaned[:2]), int(cleaned[2:4]), 0)
        if len(cleaned) == 6 and cleaned.isdigit():
            return time(int(cleaned[:2]), int(cleaned[2:4]), int(cleaned[4:6]))

    return time(0, 0, 0)


def row_to_arrival_iso(vstdate, vsttime) -> str:
    """Convert DB vstdate + vsttime into an ISO 8601 timestamp string (YYYY-MM-DDTHH:MM:SS)."""
    try:
        d = parse_db_date(vstdate)
        t = parse_db_time(vsttime)
        return datetime.combine(d, t).isoformat()
    except Exception as e:
        return datetime.now().isoformat()


def format_time_str(vsttime) -> str:
    """Format DB vsttime into clean 'HH:MM:SS' string."""
    t = parse_db_time(vsttime)
    return f"{t.hour:02d}:{t.minute:02d}:{t.second:02d}"


def format_date_str(vstdate) -> str:
    """Format DB vstdate into clean 'YYYY-MM-DD' string."""
    d = parse_db_date(vstdate)
    return d.isoformat()


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
