from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, time, datetime
from decimal import Decimal


# ---------------------------------------------------------------------------
# Raw DB row from patient_visits table
# ---------------------------------------------------------------------------

class PatientVisitRecord(BaseModel):
    """Maps directly to the patient_visits table columns."""
    id: int
    vstdate: date
    vsttime: time
    hn: str
    vn: Optional[str] = None
    patient_name: Optional[str] = None
    sex: Optional[str] = None
    age: Optional[int] = None
    chief_complaint: Optional[str] = None
    gcs: Optional[int] = None
    spo2: Optional[float] = None
    heart_rate: Optional[float] = None
    sbp: Optional[float] = None
    dbp: Optional[float] = None
    resp_rate: Optional[float] = None
    temperature: Optional[float] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    created_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Raw DB row from opdscreen (legacy HOSxP table — used as fallback)
# ---------------------------------------------------------------------------

class OpdScreenRecord(BaseModel):
    """Maps to opdscreen JOIN er_nursing_detail (legacy HOSxP schema)."""
    hn: str
    vn: str
    vstdate: date
    vsttime: str  # Stored as varchar in opdscreen
    sex: Optional[int] = None
    gcs: Optional[int] = None        # gcs_e + gcs_v + gcs_m computed in SQL
    spo2: Optional[float] = None     # o2sat from er_nursing_detail
    heart_rate: Optional[float] = None  # pulse from opdscreen
    sbp: Optional[float] = None      # bps from opdscreen
    dbp: Optional[float] = None      # bpd from opdscreen
    resp_rate: Optional[float] = None   # rr from opdscreen
    temperature: Optional[float] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    chief_complaint: Optional[str] = None  # from er_nursing_detail


# ---------------------------------------------------------------------------
# NEWS parameter scoring breakdown
# ---------------------------------------------------------------------------

class NEWSParameterScore(BaseModel):
    parameter: str
    label: str
    displayValue: str
    score: int
    isAbnormal: bool
    isCritical: bool


class NEWSResult(BaseModel):
    totalScore: int
    breakdown: List[NEWSParameterScore]
    riskLevel: str
    hasSingleParameterAlert: bool
    missingDataCount: int
    calculatedAt: str


# ---------------------------------------------------------------------------
# Patient list response (REST GET /api/patients)
# ---------------------------------------------------------------------------

class PatientListItem(BaseModel):
    """Patient record with computed NEWS result — returned by GET /api/patients."""
    id: str                          # Using hn as unique id
    hn: str
    vn: Optional[str] = None
    patient_name: Optional[str] = None
    age: Optional[int] = None
    vstdate: str                     # ISO date string
    vsttime: str                     # HH:MM:SS
    sex: Optional[str] = None
    chief_complaint: Optional[str] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    # Raw vitals (for display)
    gcs: Optional[int] = None
    spo2: Optional[float] = None
    heart_rate: Optional[float] = None
    sbp: Optional[float] = None
    dbp: Optional[float] = None
    resp_rate: Optional[float] = None
    temperature: Optional[float] = None
    # Computed
    news_result: NEWSResult
    arrival_time: str                # ISO 8601 timestamp


# ---------------------------------------------------------------------------
# WebSocket broadcast payload
# ---------------------------------------------------------------------------

class SepsisAlertPayload(BaseModel):
    hn: str
    vn: Optional[str] = None
    patient_name: Optional[str] = None
    age: Optional[int] = None
    gcs: Optional[int] = None
    spo2: Optional[float] = None
    heart_rate: Optional[float] = None
    sbp: Optional[float] = None
    dbp: Optional[float] = None
    resp_rate: Optional[float] = None
    temperature: Optional[float] = None
    sex: Optional[str] = None
    chief_complaint: Optional[str] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    vstdate: str
    vsttime: str
    news_result: NEWSResult
    is_new_alert: bool
    timestamp: str
