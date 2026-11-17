// =============================================================================
// useBackend — hooks for fetching real patient data from the FastAPI backend
// =============================================================================
//
// usePatientData()    : one-time HTTP fetch on mount, populates the store
// useWebSocketAlerts(): persistent WebSocket connection for real-time updates
// =============================================================================

import { useEffect, useRef, useCallback } from 'react';
import { useRTSASStore, hasCriticalSingleParam, buildSingleParamModalData } from '../store/useRTSASStore';
import type { Patient, TreatmentStatus } from '../types';
import { mapBackendToPatient, type BackendPatient, type BackendNEWSResult } from '../utils/patientMapper';

export interface BackendPatientsResponse {
  patients: BackendPatient[];
  count: number;
}

// ---------------------------------------------------------------------------
// usePatientData — HTTP fetch on mount
// ---------------------------------------------------------------------------

export function usePatientData() {
  const { setPatients, selectPatient, setConnectionStatus, setLoading, queueAlert } = useRTSASStore();
  const alertedKeysRef = useRef<Set<string>>(new Set());
  const singleParamAlertedKeysRef = useRef<Set<string>>(new Set());

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
        } else {
          // Only purge local treated/ruled-out cache when backend has NO record at all (e.g. dashboard reset),
          // not while an in-progress status object is transitioning to completed/archived.
          const localPData =
            useRTSASStore.getState().patientData[p.id] ||
            (p.hn ? useRTSASStore.getState().patientData[p.hn] : undefined);
          if (localPData?.treatmentCompleted || localPData?.sepsisRuledOut) {
            useRTSASStore.getState().clearTreatedPatients([p.id, p.hn]);
          }
        }
      });


      // 🚨 Detect high-risk sepsis patients (NEWS >= 5)
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

      // 🚨 Detect patients with any single parameter = +3 while total NEWS < 5 (separate from Sepsis Alert)
      const beforeSingleState = useRTSASStore.getState();
      if (beforeSingleState.ui.modal.activeModal === null && beforeSingleState.pendingAlerts.length === 0) {
        const singleParamPatient = patients.find((p) => {
          if (p.latestNewsScore >= 5) return false;
          const pData = beforeSingleState.patientData[p.id] || (p.hn ? beforeSingleState.patientData[p.hn] : undefined);
          if (
            pData?.treatmentCompleted ||
            pData?.sepsisRuledOut ||
            p.treatmentStatus?.treatment_completed ||
            p.treatmentStatus?.sepsis_ruled_out ||
            p.treatmentStatus?.acknowledged ||
            p.treatmentStatus?.doctor_confirmed
          ) {
            return false;
          }
          if (
            beforeSingleState.dismissedAlertKeys?.[p.hn] ||
            beforeSingleState.dismissedAlertKeys?.[`single3_${p.hn}`]
          ) {
            return false;
          }
          const hasSingleThree = hasCriticalSingleParam(p.latestNewsResult);
          if (!hasSingleThree) return false;
          const singleKey = `single3_${p.hn}_${p.arrivalTime || ''}_${p.latestNewsScore}`;
          return !singleParamAlertedKeysRef.current.has(singleKey);
        });

        if (singleParamPatient) {
          const singleKey = `single3_${singleParamPatient.hn}_${singleParamPatient.arrivalTime || ''}_${singleParamPatient.latestNewsScore}`;
          singleParamAlertedKeysRef.current.add(singleKey);
          useRTSASStore.getState().openModal('single_param_alert', buildSingleParamModalData(singleParamPatient));
          useRTSASStore.getState().selectPatient(singleParamPatient.id);
        }
      }

      // NOTE: Do not auto-select unassessed patients on background poll;
      // clicking a patient or acknowledging an alert opens the AVPU + O₂ gate before entering the screen.
    } catch (err) {
      console.warn('[usePatientData] Backend unavailable:', err);
      setConnectionStatus('disconnected');
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

        const wsSingleKey = `single3_${payload.hn}_${bp.arrival_time || ''}_${payload.news_result.totalScore}`;
        const wsCurState = useRTSASStore.getState();
        const hasSingleThree = hasCriticalSingleParam(patient.latestNewsResult);

        if (!isFinished && payload.is_new_alert && payload.news_result.totalScore >= 5) {
          // Queue the alert — if modal is already open it will stack, not override
          queueAlert(payload.hn, payload.news_result.totalScore);
        } else if (
          !isFinished &&
          payload.news_result.totalScore < 5 &&
          hasSingleThree &&
          !patient.treatmentStatus?.acknowledged &&
          !patient.treatmentStatus?.doctor_confirmed &&
          !wsCurState.dismissedAlertKeys?.[payload.hn] &&
          !wsCurState.dismissedAlertKeys?.[`single3_${payload.hn}`] &&
          !wsCurState.dismissedAlertKeys?.[wsSingleKey] &&
          wsCurState.ui.modal.activeModal === null &&
          wsCurState.pendingAlerts.length === 0
        ) {
          wsCurState.markAlertDismissed(wsSingleKey);
          useRTSASStore.getState().openModal('single_param_alert', buildSingleParamModalData(patient));
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


