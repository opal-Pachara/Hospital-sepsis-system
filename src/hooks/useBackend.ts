// =============================================================================
// useBackend — hooks for fetching real patient data from the FastAPI backend
// =============================================================================
//
// usePatientData()    : one-time HTTP fetch on mount, populates the store
// useWebSocketAlerts(): persistent WebSocket connection for real-time updates
// =============================================================================

import { useEffect, useRef, useCallback } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';
import type { Patient, VitalSigns, NEWSResult, NEWSParameterScore } from '../types';
import { gcsToAVPU } from '../types';

// ---------------------------------------------------------------------------
// Types matching the backend JSON response (PatientListItem schema)
// ---------------------------------------------------------------------------

interface BackendNEWSParameter {
  parameter: string;
  label: string;
  displayValue: string;
  score: number;
  isAbnormal: boolean;
  isCritical: boolean;
}

interface BackendNEWSResult {
  totalScore: number;
  breakdown: BackendNEWSParameter[];
  riskLevel: 'low' | 'low_medium' | 'medium' | 'high';
  hasSingleParameterAlert: boolean;
  missingDataCount: number;
  calculatedAt: string;
}

interface BackendPatient {
  id: string;
  hn: string;
  vn: string | null;
  patient_name: string | null;
  age: number | null;
  vstdate: string;
  vsttime: string;
  sex: 'male' | 'female' | 'other' | null;
  chief_complaint: string | null;
  weight: number | null;
  height: number | null;
  gcs: number | null;
  spo2: number | null;
  heart_rate: number | null;
  sbp: number | null;
  dbp: number | null;
  resp_rate: number | null;
  temperature: number | null;
  news_result: BackendNEWSResult;
  arrival_time: string;
}

interface BackendPatientsResponse {
  patients: BackendPatient[];
  count: number;
}

// ---------------------------------------------------------------------------
// Mapper: BackendPatient → frontend Patient type
// ---------------------------------------------------------------------------

function mapBackendToPatient(bp: BackendPatient): Patient {
  const gcs = bp.gcs ?? 15;

  const vitals: VitalSigns = {
    respiratoryRate: bp.resp_rate ?? null,
    spO2: bp.spo2 ?? null,
    oxygenSupplementation: 'room_air',
    temperature: bp.temperature ?? null,
    systolicBP: bp.sbp ?? null,
    heartRate: bp.heart_rate ?? null,
    gcs,
    avpu: gcsToAVPU(gcs),
  };

  // Map backend NEWSResult to frontend NEWSResult
  const newsResult: NEWSResult = {
    totalScore: bp.news_result.totalScore,
    breakdown: bp.news_result.breakdown.map((b): NEWSParameterScore => ({
      parameter: b.parameter as NEWSParameterScore['parameter'],
      label: b.label,
      displayValue: b.displayValue,
      score: b.score,
      isAbnormal: b.isAbnormal,
      isCritical: b.isCritical,
    })),
    riskLevel: bp.news_result.riskLevel,
    hasSingleParameterAlert: bp.news_result.hasSingleParameterAlert,
    missingDataCount: bp.news_result.missingDataCount,
    calculatedAt: bp.news_result.calculatedAt,
  };

  return {
    id: bp.hn,
    hn: bp.hn,
    vn: bp.vn ?? '',
    fullName: bp.patient_name ?? bp.hn,  // Use real name if available
    age: bp.age ?? 0,
    gender: bp.sex ?? 'other',
    triageLevel: riskToTriageLevel(bp.news_result.riskLevel),
    arrivalTime: bp.arrival_time,
    chiefComplaint: bp.chief_complaint ?? 'ไม่ระบุ',
    allergies: [],
    currentRiskLevel: bp.news_result.riskLevel,
    latestNewsScore: bp.news_result.totalScore,
    latestVitals: vitals,
    latestNewsResult: newsResult,
    hasSepsisAlert: bp.news_result.totalScore >= 5 || bp.news_result.hasSingleParameterAlert,
    attendingPhysician: null,
    primaryNurse: null,
    location: `VN: ${bp.vn ?? '-'}`,
  };
}

function riskToTriageLevel(risk: string): Patient['triageLevel'] {
  if (risk === 'high') return 'resuscitation';
  if (risk === 'medium') return 'emergency';
  if (risk === 'low_medium') return 'urgent';
  return 'semi_urgent';
}

// ---------------------------------------------------------------------------
// usePatientData — HTTP fetch on mount
// ---------------------------------------------------------------------------

export function usePatientData() {
  const { setPatients, selectPatient, addTimelineEvent, setConnectionStatus, openModal } = useRTSASStore();

  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch('/api/patients');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: BackendPatientsResponse = await res.json();
      const patients = data.patients.map(mapBackendToPatient);

      setPatients(patients);

      // Auto-select the highest risk patient on first load
      if (patients.length > 0) {
        const highest = patients[0]; // Already sorted by NEWS desc from backend
        selectPatient(highest.id);

        // Log to console only — not to clinical Timeline
        console.log(`[RTSAS] Loaded ${data.count} patients. Top risk: HN ${highest.hn} NEWS ${highest.latestNewsScore}`);

        // 🚨 Open alert modal if the top patient is high risk
        if (highest.hasSepsisAlert) {
          openModal('alert', {
            newsScore: highest.latestNewsScore,
            patientName: highest.hn,
          });
        }
      }

      console.log(`[usePatientData] Loaded ${data.count} patients from backend.`);
    } catch (err) {
      console.error('[usePatientData] Failed to fetch patients:', err);
      setConnectionStatus('disconnected');
    }
  }, [setPatients, selectPatient, setConnectionStatus, openModal]);

  useEffect(() => {
    fetchPatients();

    // Refresh patient list every 60s (WebSocket handles real-time; HTTP is fallback sync)
    const interval = setInterval(fetchPatients, 60_000);
    return () => clearInterval(interval);
  }, [fetchPatients]);
}

// ---------------------------------------------------------------------------
// useWebSocketAlerts — persistent real-time WebSocket connection
// ---------------------------------------------------------------------------

export function useWebSocketAlerts() {
  const { patients, setPatients, setConnectionStatus, addTimelineEvent, openModal, queueAlert } = useRTSASStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  const connect = useCallback(() => {
    if (!isMounted.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/alerts`;

    console.log('[WebSocket] Connecting to', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMounted.current) return;
      console.log('[WebSocket] Connected.');
      setConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
      if (!isMounted.current) return;
      try {
        const payload = JSON.parse(event.data) as {
          hn: string;
          vn: string | null;
          patient_name: string | null;
          age: number | null;
          gcs: number | null;
          spo2: number | null;
          heart_rate: number | null;
          sbp: number | null;
          dbp: number | null;
          resp_rate: number | null;
          temperature: number | null;
          sex: 'male' | 'female' | 'other' | null;
          chief_complaint: string | null;
          weight: number | null;
          height: number | null;
          vstdate: string;
          vsttime: string;
          news_result: BackendNEWSResult;
          is_new_alert: boolean;
          timestamp: string;
        };

        const bp: BackendPatient = {
          id: payload.hn,
          hn: payload.hn,
          vn: payload.vn,
          patient_name: payload.patient_name,
          age: payload.age,
          vstdate: payload.vstdate,
          vsttime: payload.vsttime,
          sex: payload.sex,
          chief_complaint: payload.chief_complaint,
          weight: payload.weight,
          height: payload.height,
          gcs: payload.gcs,
          spo2: payload.spo2,
          heart_rate: payload.heart_rate,
          sbp: payload.sbp,
          dbp: payload.dbp,
          resp_rate: payload.resp_rate,
          temperature: payload.temperature,
          news_result: payload.news_result,
          arrival_time: payload.timestamp,
        };

        const patient = mapBackendToPatient(bp);
        const currentPatients = useRTSASStore.getState().patients;
        const exists = currentPatients.find((p) => p.id === patient.id);

        if (!exists) {
          // New patient arrived — log to console only, not clinical Timeline
          setPatients([patient, ...currentPatients]);
          console.log(`[RTSAS] New patient added: HN ${patient.hn} NEWS ${patient.latestNewsScore}`);
        } else {
          // Existing patient — update vitals silently
          const updatedPatients = currentPatients.map((p) =>
            p.id === patient.id ? { ...p, ...patient } : p
          );
          setPatients(updatedPatients);
        }

        // 🚨 Queue alert for high-risk patients (new readings only)
        // Use queueAlert instead of openModal to avoid interrupting the current patient view
        if (payload.is_new_alert &&
           (payload.news_result.totalScore >= 5 || payload.news_result.hasSingleParameterAlert)) {

          // Queue the alert — if modal is already open it will stack, not override
          queueAlert(payload.hn, payload.news_result.totalScore);

          // ✅ Clinical alert in Timeline (no HN for privacy)
          addTimelineEvent(
            `⚠️ ระบบตรวจพบ NEWS ${payload.news_result.totalScore} — ต้องประเมินทันที`,
            payload.news_result.totalScore >= 7 ? 'red' : 'orange',
            'System'
          );
        }
      } catch (err) {
        console.error('[WebSocket] Failed to parse message:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('[WebSocket] Error:', err);
      setConnectionStatus('reconnecting');
    };

    ws.onclose = () => {
      if (!isMounted.current) return;
      console.log('[WebSocket] Disconnected. Reconnecting in 5s...');
      setConnectionStatus('reconnecting');
      reconnectTimer.current = setTimeout(() => {
        if (isMounted.current) connect();
      }, 5000);
    };
  }, [setConnectionStatus, setPatients, addTimelineEvent]);

  useEffect(() => {
    isMounted.current = true;
    connect();

    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
