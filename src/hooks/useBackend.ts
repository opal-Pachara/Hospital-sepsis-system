// =============================================================================
// useBackend — hooks for fetching real patient data from the FastAPI backend
// =============================================================================
//
// usePatientData()    : one-time HTTP fetch on mount, populates the store
// useWebSocketAlerts(): persistent WebSocket connection for real-time updates
// =============================================================================

import { useEffect, useRef, useCallback } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';
import type { Patient, VitalSigns, NEWSResult, NEWSParameterScore, TreatmentStatus } from '../types';
import { gcsToAVPU } from '../types';
import { maskHN } from '../utils/hnMask';
import { MOCK_PATIENTS } from '../data/mockData';

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
  treatment_status?: any;
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

  const nr = bp.news_result || {
    totalScore: 0,
    breakdown: [],
    riskLevel: 'low' as const,
    hasSingleParameterAlert: false,
    missingDataCount: 0,
    calculatedAt: new Date().toISOString(),
  };

  // Map backend NEWSResult to frontend NEWSResult
  const newsResult: NEWSResult = {
    totalScore: nr.totalScore ?? 0,
    breakdown: (nr.breakdown || []).map((b): NEWSParameterScore => ({
      parameter: b.parameter as NEWSParameterScore['parameter'],
      label: b.label,
      displayValue: b.displayValue,
      score: b.score,
      isAbnormal: b.isAbnormal,
      isCritical: b.isCritical,
    })),
    riskLevel: nr.riskLevel || 'low',
    hasSingleParameterAlert: nr.hasSingleParameterAlert ?? false,
    missingDataCount: nr.missingDataCount ?? 0,
    calculatedAt: nr.calculatedAt || new Date().toISOString(),
  };

  // Safely construct arrivalTime:
  // If bp.arrival_time is missing or default midnight (T00:00:00) while vsttime has real time, use vstdate + vsttime
  let arrivalTime = bp.arrival_time;
  if ((!arrivalTime || arrivalTime.endsWith('T00:00:00') || arrivalTime.endsWith('T00:00')) && bp.vsttime) {
    const timeParts = bp.vsttime.split(':');
    if (timeParts.length >= 2) {
      const hh = timeParts[0].padStart(2, '0');
      const mm = timeParts[1].padStart(2, '0');
      const ss = (timeParts[2] || '00').padStart(2, '0');
      const datePart = bp.vstdate || new Date().toISOString().split('T')[0];
      arrivalTime = `${datePart}T${hh}:${mm}:${ss}`;
    }
  }

  return {
    id: bp.hn,
    hn: bp.hn,
    vn: bp.vn ?? '',
    fullName: maskHN(bp.hn),
    age: (bp.age != null && bp.age > 0) ? bp.age : null,
    gender: bp.sex ?? 'other',
    triageLevel: riskToTriageLevel(bp.news_result.riskLevel),
    arrivalTime: arrivalTime || new Date().toISOString(),
    chiefComplaint: bp.chief_complaint ?? 'ไม่ระบุ',
    allergies: [],
    currentRiskLevel: bp.news_result.riskLevel,
    latestNewsScore: bp.news_result.totalScore,
    latestVitals: vitals,
    latestNewsResult: newsResult,
    hasSepsisAlert: bp.news_result.totalScore >= 5 && bp.news_result.riskLevel === 'high',
    attendingPhysician: null,
    primaryNurse: null,
    location: `VN: ${bp.vn ?? '-'}`,
    treatmentStatus: (bp as any).treatment_status ?? null,
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
  const { setPatients, selectPatient, setConnectionStatus, setLoading, queueAlert } = useRTSASStore();
  const alertedKeysRef = useRef<Set<string>>(new Set());

  const fetchPatients = useCallback(async (forceRefresh = false) => {
    try {
      const url = forceRefresh ? '/api/patients?refresh=true' : '/api/patients';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: BackendPatientsResponse = await res.json();
      const patients = data.patients.map(mapBackendToPatient);

      setConnectionStatus('connected');
      const curSelectedId = useRTSASStore.getState().selectedPatient?.id;
      setPatients(patients);

      // Preserve active selected patient if one was currently being treated
      if (curSelectedId && !useRTSASStore.getState().selectedPatient) {
        useRTSASStore.getState().selectPatient(curSelectedId);
      }

      // Synchronize centralized treatment status from backend into store
      patients.forEach((p) => {
        if (p.treatmentStatus) {
          useRTSASStore.getState().syncServerTreatmentStatus(p.treatmentStatus);
        }
      });


      // 🚨 Detect high-risk sepsis patients (NEWS >= 5 or single parameter alert)
      // that have not been alerted yet in this session and haven't finished treatment
      const patientDataStore = useRTSASStore.getState().patientData;
      const highRisk = patients.filter((p) => {
        if (!p.hasSepsisAlert) return false;

        const pData = patientDataStore[p.id] || (p.hn ? patientDataStore[p.hn] : undefined);
        // If treatment is already completed or ruled out, do not alert
        if (pData?.treatmentCompleted || pData?.sepsisRuledOut || p.treatmentStatus?.treatment_completed || p.treatmentStatus?.sepsis_ruled_out) return false;

        // Signature to avoid re-alerting the exact same reading
        const alertKey = `${p.hn}_${p.arrivalTime || ''}_${p.latestNewsScore}`;
        if (alertedKeysRef.current.has(alertKey)) return false;

        return true;
      });

      if (highRisk.length > 0) {
        console.log(`[RTSAS] Detected ${highRisk.length} high-risk patient alert(s) on data fetch.`);
        highRisk.forEach((p) => {
          const alertKey = `${p.hn}_${p.arrivalTime || ''}_${p.latestNewsScore}`;
          alertedKeysRef.current.add(alertKey);
          queueAlert(p.hn, p.latestNewsScore);
        });
      } else {
        console.log(`[RTSAS] Refreshed ${data.count} patients.`);
      }
    } catch (err) {
      console.warn('[usePatientData] Backend unavailable — fallback to offline demo patient data:', err);
      setConnectionStatus('disconnected');

      const currentPatients = useRTSASStore.getState().patients;
      if (!currentPatients || currentPatients.length === 0) {
        setPatients(MOCK_PATIENTS);
      }
    } finally {
      setLoading(false);
    }
  }, [setPatients, selectPatient, setConnectionStatus, setLoading, queueAlert]);

  useEffect(() => {
    fetchPatients();

    // Refresh patient list every 10s (matches backend scheduler polling)
    const interval = setInterval(() => {
      fetchPatients(false);
    }, 10_000);
    return () => clearInterval(interval);
  }, [fetchPatients]);

  return { fetchPatients };
}

// ---------------------------------------------------------------------------
// useWebSocketAlerts — persistent real-time WebSocket connection
// ---------------------------------------------------------------------------

export function useWebSocketAlerts() {
  const { setPatients, setConnectionStatus, queueAlert } = useRTSASStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  const connectRef = useRef<() => void>(() => { });

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
        const raw = JSON.parse(event.data);

        // Centralized treatment status updates broadcast from backend
        if (raw.type === 'TREATMENT_STATUS_UPDATE') {
          if (raw.action === 'clear_treated') {
            console.log('[WebSocket] Received clear_treated for HNs:', raw.cleared_hns);
            useRTSASStore.getState().clearTreatedPatients(raw.cleared_hns);
          } else if (raw.action === 'archived') {
            // Patient has been archived — update status in patient list
            const archivedHn = raw.hn || raw.data?.hn;
            if (archivedHn) {
              console.log(`[WebSocket] Patient ${archivedHn} archived — synchronizing status`);
              const state = useRTSASStore.getState();
              // Update treatmentStatus in patients array without removing the patient or switching away
              const updatedPatients = state.patients.map((p) =>
                (p.id === archivedHn || p.hn === archivedHn)
                  ? {
                      ...p,
                      treatmentStatus: {
                        ...(p.treatmentStatus || {}),
                        ...(raw.data || {}),
                        hn: p.hn,
                        is_archived: true,
                        sepsis_ruled_out: raw.data?.sepsis_ruled_out ?? (p.treatmentStatus?.sepsis_ruled_out ?? true),
                      } as TreatmentStatus,
                    }
                  : p
              );
              setPatients(updatedPatients);

              // Synchronize patient data in store so all fields update cleanly
              if (raw.data) {
                useRTSASStore.getState().syncServerTreatmentStatus(raw.data);
              }

              // 🛑 CLINICAL REQUIREMENT: NEVER bounce to another patient when a patient is ruled out / archived!
              // Keep the current patient view intact so clinicians can review and copy their Timeline.
            }
          } else if (raw.data) {
            useRTSASStore.getState().syncServerTreatmentStatus(raw.data);
          }
          return;
        }

        const payload = raw as {
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
          age: (payload.age != null && payload.age > 0) ? payload.age : null,
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
        // Guard: Never alert or re-treat if treatment is already completed or ruled out
        const pData = useRTSASStore.getState().patientData[payload.hn] || useRTSASStore.getState().patientData[patient.id];
        const isFinished = Boolean(
          pData?.treatmentCompleted ||
          pData?.sepsisRuledOut ||
          patient.treatmentStatus?.treatment_completed ||
          patient.treatmentStatus?.sepsis_ruled_out
        );

        if (!isFinished && payload.is_new_alert &&
          (payload.news_result.totalScore >= 5 || payload.news_result.hasSingleParameterAlert)) {

          // Queue the alert — if modal is already open it will stack, not override
          queueAlert(payload.hn, payload.news_result.totalScore);
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
        if (isMounted.current) connectRef.current();
      }, 5000);
    };
  }, [setConnectionStatus, setPatients, queueAlert]);

  useEffect(() => {
    isMounted.current = true;
    connectRef.current = connect;
    connect();

    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}


