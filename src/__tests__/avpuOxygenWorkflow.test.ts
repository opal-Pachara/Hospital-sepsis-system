import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculateNEWS, scoreOxygenSupplementation } from '../utils/newsCalculator';
import { useRTSASStore, requiresInitialAvpuO2Gate, hasCriticalSingleParam, buildSingleParamModalData } from '../store/useRTSASStore';
import { calculateMAP } from '../types';
import type { Patient, VitalSigns } from '../types';
import { AlertModalContent } from '../components/modals/AlertModal';
import { SingleParamAlertModalContent, resolveSingleParamAlertTarget } from '../components/modals/SingleParamAlertModal';

describe('NEWS 2012 AVPU Consciousness Assessment & Supplemental Oxygen Workflow', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
  });

  describe('calculateNEWS scoring rules (NEWS 2012)', () => {
    const normalVitals: VitalSigns = {
      respiratoryRate: 16, // 0 pts
      spO2: 98,            // 0 pts
      oxygenSupplementation: 'room_air', // 0 pts
      temperature: 37.0,   // 0 pts
      systolicBP: 120,     // 0 pts
      heartRate: 75,       // 0 pts
      gcs: 15,
      avpu: 'A',
      isAvpuConfirmed: true,
      avpuStatus: 'confirmed',
    };

    it('Rule 1: when GCS = 15, automatically scores Alert = 0 without requiring extra confirmation', () => {
      const result = calculateNEWS({
        ...normalVitals,
        isAvpuConfirmed: false,
        avpuStatus: 'pending_confirmation',
      });
      expect(result.riskLevel).toBe('low');
      expect(result.isComplete).toBe(true);
      expect(result.totalScore).toBe(0);
      expect(result.needsAvpuPrompt).toBe(false);
    });

    it('Rule 1 & 4: when GCS < 15 and pending assessment while other vitals < 5, returns incomplete and needsAvpuPrompt=true without assigning NEWS 3', () => {
      const gcs13Vitals: VitalSigns = {
        ...normalVitals,
        gcs: 13,
        avpu: 'A',
        isAvpuConfirmed: false,
        avpuStatus: 'pending_assessment',
      };
      const result = calculateNEWS(gcs13Vitals);
      expect(result.riskLevel).toBe('incomplete');
      expect(result.isComplete).toBe(false);
      expect(result.needsAvpuPrompt).toBe(true);
      expect(result.totalScore).toBe(0); // AVPU score not added yet
      expect(result.missingParameters).toContain('รอประเมิน AVPU (GCS < 15)');
    });

    it('Rule 4: when other vitals sum >= 5 while GCS < 15 (AVPU pending), escalates immediately to High Risk without waiting for AVPU', () => {
      const highVitalsPending: VitalSigns = {
        respiratoryRate: 26, // 3 pts
        spO2: 92,            // 2 pts (Total other = 5 pts)
        oxygenSupplementation: 'room_air', // 0 pts
        temperature: 37.0,   // 0 pts
        systolicBP: 120,     // 0 pts
        heartRate: 75,       // 0 pts
        gcs: 12,
        avpu: 'V',
        isAvpuConfirmed: false,
        avpuStatus: 'pending_assessment',
      };
      const result = calculateNEWS(highVitalsPending);
      expect(result.riskLevel).toBe('high');
      expect(result.hasSingleParameterAlert).toBe(true);
      expect(result.isComplete).toBe(false);
      expect(result.needsAvpuPrompt).toBe(false);
      expect(result.totalScore).toBe(5);
    });

    it('Rule 1: when GCS < 15 is explicitly assessed as A (0 pts) vs V/P/U (3 pts), scores accurately', () => {
      const assessedAlert: VitalSigns = {
        ...normalVitals,
        gcs: 14,
        avpu: 'A',
        isAvpuConfirmed: true,
        avpuStatus: 'confirmed',
      };
      expect(calculateNEWS(assessedAlert).totalScore).toBe(0);

      const assessedVoice: VitalSigns = {
        ...normalVitals,
        gcs: 12,
        avpu: 'V',
        isAvpuConfirmed: true,
        avpuStatus: 'confirmed',
      };
      const result = calculateNEWS(assessedVoice);
      expect(result.totalScore).toBe(3);
      expect(result.isComplete).toBe(true);
      expect(result.hasSingleParameterAlert).toBe(true);
      expect(result.riskLevel).toBe('low_medium');
    });

    it('Rule 2 & 3: Supplemental Oxygen 3-tier triage when oxygenSupplementation is unassessed', () => {
      expect(scoreOxygenSupplementation('room_air')).toBe(0);
      expect(scoreOxygenSupplementation('supplemental')).toBe(2);
      expect(scoreOxygenSupplementation('unassessed')).toBe(0);

      // Tier 1: 0–2 points (e.g. 2 points) + unassessed O2 -> Low risk, no prompt, isComplete = false
      const tier1 = calculateNEWS({
        ...normalVitals,
        respiratoryRate: 22, // 2 pts
        oxygenSupplementation: 'unassessed',
      });
      expect(tier1.totalScore).toBe(2);
      expect(tier1.riskLevel).toBe('low');
      expect(tier1.isComplete).toBe(false);
      expect(tier1.needsOxygenPrompt).toBe(false);

      // Tier 2: 3–4 points (e.g. 3 points) + unassessed O2 -> Incomplete, needsOxygenPrompt = true
      const tier2 = calculateNEWS({
        ...normalVitals,
        respiratoryRate: 26, // 3 pts
        oxygenSupplementation: 'unassessed',
      });
      expect(tier2.totalScore).toBe(3);
      expect(tier2.riskLevel).toBe('incomplete');
      expect(tier2.isComplete).toBe(false);
      expect(tier2.needsOxygenPrompt).toBe(true);

      // Tier 3: >= 5 points (e.g. 5 points) + unassessed O2 -> Immediate High risk alert, needsOxygenPrompt = false
      const tier3 = calculateNEWS({
        ...normalVitals,
        respiratoryRate: 26, // 3 pts
        spO2: 92,            // 2 pts (sum = 5)
        oxygenSupplementation: 'unassessed',
      });
      expect(tier3.totalScore).toBe(5);
      expect(tier3.riskLevel).toBe('high');
      expect(tier3.isComplete).toBe(false);
      expect(tier3.needsOxygenPrompt).toBe(false);
    });
  });

  describe('useRTSASStore AVPU and Oxygen actions', () => {
    beforeEach(() => {
      useRTSASStore.setState({
        patients: [
          {
            id: 'p-1',
            hn: 'HN001',
            fullName: 'นายทดสอบ ระบบ',
            gender: 'male',
            age: 50,
            arrivalTime: new Date().toISOString(),
            chiefComplaint: 'ไข้สูง หนาวสั่น',
            location: 'ER Triage',
            latestVitals: {
              respiratoryRate: 16,
              spO2: 98,
              oxygenSupplementation: 'room_air',
              temperature: 37.0,
              systolicBP: 120,
              diastolicBP: 80,
              heartRate: 75,
              gcs: 14,
              avpu: 'A',
              isAvpuConfirmed: false,
              avpuStatus: 'pending_assessment',
            },
            latestNewsScore: 0,
            currentRiskLevel: 'incomplete',
            hasSepsisAlert: false,
            acknowledged: false,
            hasSingleParameterAlert: false,
            timeline: [],
            treatmentStatus: {
              hn: 'HN001',
              avpu_status: 'pending_assessment',
              supplemental_oxygen: 'room_air',
            },
          } as unknown as Patient,
        ],
        selectedPatient: null,
      });
    });

    it('confirmAlert confirms Alert and recalculates NEWS', async () => {
      const store = useRTSASStore.getState();
      await store.confirmAlert('p-1');

      const updated = useRTSASStore.getState().patients.find((p) => p.id === 'p-1');
      expect(updated?.latestVitals.isAvpuConfirmed).toBe(true);
      expect(updated?.latestVitals.avpuStatus).toBe('confirmed');
      expect(updated?.treatmentStatus?.avpu_status).toBe('confirmed');
      expect(updated?.treatmentStatus?.assessed_avpu).toBe('A');
      expect(updated?.currentRiskLevel).toBe('low');
    });

    it('assessAVPU sets explicit AVPU level and optional supplementalOxygen, recalculating score', async () => {
      const store = useRTSASStore.getState();
      await store.assessAVPU('p-1', 'V', true);

      const updated = useRTSASStore.getState().patients.find((p) => p.id === 'p-1');
      expect(updated?.latestVitals.avpu).toBe('V');
      expect(updated?.latestVitals.oxygenSupplementation).toBe('supplemental');
      expect(updated?.latestVitals.isAvpuConfirmed).toBe(true);
      expect(updated?.latestVitals.avpuStatus).toBe('confirmed');
      expect(updated?.treatmentStatus?.assessed_avpu).toBe('V');
      expect(updated?.latestNewsScore).toBe(5); // V (3) + Supplemental O2 (2) = 5
      expect(updated?.hasSepsisAlert).toBe(true);
    });

    it('toggleOxygenSupplementation toggles between room_air and supplemental', async () => {
      const store = useRTSASStore.getState();

      // First confirm AVPU
      await store.confirmAlert('p-1');

      // Toggle to supplemental O2
      await store.toggleOxygenSupplementation('p-1');
      let updated = useRTSASStore.getState().patients.find((p) => p.id === 'p-1');
      expect(updated?.latestVitals.oxygenSupplementation).toBe('supplemental');
      expect(updated?.treatmentStatus?.supplemental_oxygen).toBe('supplemental');
      expect(updated?.latestNewsScore).toBe(2);

      // Toggle back to room_air
      await store.toggleOxygenSupplementation('p-1');
      updated = useRTSASStore.getState().patients.find((p) => p.id === 'p-1');
      expect(updated?.latestVitals.oxygenSupplementation).toBe('room_air');
      expect(updated?.treatmentStatus?.supplemental_oxygen).toBe('room_air');
      expect(updated?.latestNewsScore).toBe(0);
    });

    it('calculates MAP automatically from SBP and DBP and logs MAP in Phase 4 completeAssessment timeline', () => {
      expect(calculateMAP(120, 80)).toBe(93);
      expect(calculateMAP(85, 50)).toBe(62);
      expect(calculateMAP(90, null)).toBeNull();

      const store = useRTSASStore.getState();
      store.generateSchedule('2026-11-09T16:00:00');
      const entry1 = useRTSASStore.getState().assessmentSchedule!.entries[0];

      store.completeAssessment(
        entry1.id,
        {
          respiratoryRate: 20,
          spO2: 98,
          oxygenSupplementation: 'room_air',
          temperature: 37.0,
          systolicBP: 90,
          diastolicBP: 55,
          map: calculateMAP(90, 55),
          heartRate: 88,
          gcs: 15,
          avpu: 'A',
        },
        'พยาบาลห้องฉุกเฉิน'
      );

      const tl = useRTSASStore.getState().timeline;
      expect(tl.some((e) => e.actionText.includes('MAP 67 mmHg'))).toBe(true);
    });
  });

  describe('Single-parameter +3 popup separation and red highlight rules', () => {
    const baseVitals: VitalSigns = {
      respiratoryRate: 16,
      spO2: 98,
      oxygenSupplementation: 'room_air',
      temperature: 37.0,
      systolicBP: 120,
      diastolicBP: 80,
      heartRate: 75,
      gcs: 15,
      avpu: 'A',
      isAvpuConfirmed: true,
      avpuStatus: 'confirmed',
    };

    beforeEach(() => {
      useRTSASStore.setState((s) => ({
        ui: { ...s.ui, modal: { activeModal: null, modalData: null } },
      }));
    });

    it('opens separate single_param_alert popup (not Sepsis Alert) when a parameter is +3 and total NEWS < 5', async () => {
      const patient: Patient = {
        id: 'p-single3',
        hn: 'HN-SINGLE3',
        vn: 'VN-SINGLE3',
        fullName: 'ผู้ป่วย ทดสอบ +3',
        age: 50,
        gender: 'male',
        triageLevel: 'urgent',
        arrivalTime: new Date().toISOString(),
        chiefComplaint: 'หายใจเร็ว',
        allergies: [],
        currentRiskLevel: 'incomplete',
        latestNewsScore: 0,
        latestVitals: { ...baseVitals, gcs: 13, isAvpuConfirmed: false, avpuStatus: 'pending_assessment' },
        latestNewsResult: calculateNEWS({ ...baseVitals, gcs: 13, isAvpuConfirmed: false, avpuStatus: 'pending_assessment' }),
        hasSepsisAlert: false,
        attendingPhysician: null,
        primaryNurse: null,
        location: 'ER',
      };

      useRTSASStore.setState({ patients: [patient], selectedPatient: patient });

      // 1. assessAVPU('V', false) => AVPU +3, total score = 3 (< 5) -> single_param_alert
      await useRTSASStore.getState().assessAVPU(patient.id, 'V', false);
      expect(useRTSASStore.getState().ui.modal.activeModal).toBe('single_param_alert');
      expect((useRTSASStore.getState().ui.modal.modalData as any)?.newsScore).toBe(3);

      // 2. toggleOxygenSupplementation => +2 O2 makes total score = 5 (>= 5) -> red Sepsis Alert ('alert')
      await useRTSASStore.getState().toggleOxygenSupplementation(patient.id, true);
      expect(useRTSASStore.getState().ui.modal.activeModal).toBe('alert');
      expect((useRTSASStore.getState().ui.modal.modalData as any)?.newsScore).toBe(5);

      // 3. updatePatientVitals with single RR=26 (+3) and others 0 => single_param_alert
      useRTSASStore.getState().updatePatientVitals(patient.id, { ...baseVitals, respiratoryRate: 26 });
      expect(useRTSASStore.getState().ui.modal.activeModal).toBe('single_param_alert');
      expect((useRTSASStore.getState().ui.modal.modalData as any)?.newsScore).toBe(3);
    });

    it('renders SingleParamAlertModal with red highlight only on <=3 score & +3 parameters while keeping <3 normal', () => {
      const vitals: VitalSigns = {
        ...baseVitals,
        respiratoryRate: 26, // +3
        temperature: 38.5,   // +1 (total = 4? test <=3 with 37.0 first, plus check <3 with SpO2=95)
      };
      // Let's use RR=26 (+3), SpO2=98 (+0), Temp=37.0 (+0), SBP=120 (+0), HR=75 (+0) => total = 3
      const vitalsScore3: VitalSigns = { ...vitals, temperature: 37.0 };
      const news3 = calculateNEWS(vitalsScore3);

      const patient: Patient = {
        id: 'p-ui-3',
        hn: 'HN-UI-3',
        vn: 'VN-UI-3',
        fullName: 'ผู้ป่วย 3 คะแนน',
        age: 45,
        gender: 'female',
        triageLevel: 'urgent',
        arrivalTime: new Date().toISOString(),
        chiefComplaint: 'หายใจเหนื่อย',
        allergies: [],
        currentRiskLevel: 'low_medium',
        latestNewsScore: news3.totalScore,
        latestVitals: vitalsScore3,
        latestNewsResult: news3,
        hasSepsisAlert: false,
        attendingPhysician: null,
        primaryNurse: null,
        location: 'ER',
      };

      const html = renderToStaticMarkup(
        createElement(SingleParamAlertModalContent, {
          patient,
          alertHN: patient.hn,
          alertNewsScore: news3.totalScore,
          onAcknowledge: () => {},
          onAssessPending: () => {},
          onClose: () => {},
        })
      );
      expect(html).toContain('แจ้งเตือนพารามิเตอร์วิกฤต (+3 คะแนน)');
      expect(html).toContain('คะแนนรวม ≤ 3 (มีพารามิเตอร์ +3)');
      expect(html).toContain('data-testid="single-param-critical-box"');
      expect(html).toContain('อัตราการหายใจ (RR): 26 bpm');
      expect(html).toContain('data-critical-param="true"');
      expect(html).toContain('data-critical-param="false"');
      // Normal parameters (< 3) remain neutral (#475569), NOT highlighted red
      expect(html).toMatch(/data-critical-param="false"[^>]*style="[^"]*color:#475569/);
    });

    it('renders AlertModal highlighting only +3 parameters in red while keeping +1/+2/+0 parameters normal', () => {
      const vitalsHigh: VitalSigns = {
        ...baseVitals,
        respiratoryRate: 26, // +3 (should be RED)
        temperature: 38.5,   // +1 (should stay normal)
        heartRate: 120,      // +2 (should stay normal)
      };
      const newsHigh = calculateNEWS(vitalsHigh); // total = 6 >= 5

      const patient: Patient = {
        id: 'p-ui-high',
        hn: 'HN-UI-HIGH',
        vn: 'VN-UI-HIGH',
        fullName: 'ผู้ป่วย NEWS 6',
        age: 70,
        gender: 'male',
        triageLevel: 'resuscitation',
        arrivalTime: new Date().toISOString(),
        chiefComplaint: 'ไข้สูง หอบเหนื่อย',
        allergies: [],
        currentRiskLevel: 'high',
        latestNewsScore: newsHigh.totalScore,
        latestVitals: vitalsHigh,
        latestNewsResult: newsHigh,
        hasSepsisAlert: true,
        attendingPhysician: null,
        primaryNurse: null,
        location: 'ER',
      };

      const html = renderToStaticMarkup(
        createElement(AlertModalContent, {
          patient,
          alertNewsScore: newsHigh.totalScore,
          pendingCount: 0,
          onAcknowledge: () => {},
          onClose: () => {},
        })
      );
      expect(html).toContain('เสี่ยงติดเชื้อในกระแสเลือด');
      expect(html).toContain('data-testid="alert-critical-params-box"');
      expect(html).toContain('อัตราการหายใจ (RR): 26 bpm');
      expect(html).toMatch(/data-critical-param="true"[^>]*style="[^"]*color:#b91c1c/);
      expect(html).toMatch(/data-critical-param="false"[^>]*style="[^"]*color:#475569/);
    });

    it('requiresInitialAvpuO2Gate blocks entry until both AVPU and O2 are assessed, even when GCS=15', async () => {
      const patientGcs15UnassessedO2: Patient = {
        id: 'p-gate-1',
        hn: 'HN-GATE-1',
        vn: 'VN-GATE-1',
        fullName: 'ผู้ป่วย Gate GCS 15',
        age: 40,
        gender: 'female',
        triageLevel: 'semi_urgent',
        arrivalTime: new Date().toISOString(),
        chiefComplaint: 'ไข้',
        allergies: [],
        currentRiskLevel: 'low',
        latestNewsScore: 1,
        latestVitals: {
          ...baseVitals,
          gcs: 15,
          avpu: 'A',
          isAvpuConfirmed: true,
          avpuStatus: 'confirmed',
          oxygenSupplementation: 'unassessed',
        },
        latestNewsResult: calculateNEWS({
          ...baseVitals,
          gcs: 15,
          oxygenSupplementation: 'unassessed',
        }),
        hasSepsisAlert: false,
        attendingPhysician: null,
        primaryNurse: null,
        location: 'ER',
      };

      const patientCompleted: Patient = {
        ...patientGcs15UnassessedO2,
        id: 'p-gate-done',
        hn: 'HN-GATE-DONE',
        treatmentStatus: { hn: 'HN-GATE-DONE', treatment_completed: true },
      };

      expect(requiresInitialAvpuO2Gate(patientGcs15UnassessedO2)).toBe(true);
      expect(requiresInitialAvpuO2Gate(patientCompleted)).toBe(false);

      useRTSASStore.setState({ patients: [patientGcs15UnassessedO2], selectedPatient: null });
      useRTSASStore.getState().selectPatient('p-gate-1');

      const stAfterSelect = useRTSASStore.getState();
      expect(stAfterSelect.ui.modal.activeModal).toBe('avpu_assessment');
      expect((stAfterSelect.ui.modal.modalData as any)?.isInitialGate).toBe(true);
      expect(requiresInitialAvpuO2Gate(stAfterSelect.selectedPatient, stAfterSelect.patientData)).toBe(true);

      // Complete both AVPU and Supplemental O2 -> gate clears
      await useRTSASStore.getState().assessAVPU('p-gate-1', 'A', false);
      const stAfterAssess = useRTSASStore.getState();
      expect(requiresInitialAvpuO2Gate(stAfterAssess.selectedPatient, stAfterAssess.patientData)).toBe(false);
    });

    it('highlights SpO2 <= 91% (+3) in red with SpO2 label and never falls back to unrelated selectedPatient', () => {
      const vitalsSpo2Critical: VitalSigns = {
        ...baseVitals,
        spO2: 70, // +3
      };
      const newsSpo2 = calculateNEWS(vitalsSpo2Critical);
      expect(newsSpo2.totalScore).toBe(3);
      expect(hasCriticalSingleParam(newsSpo2)).toBe(true);

      const spo2Patient: Patient = {
        id: '000391054',
        hn: '000391054',
        vn: 'VN-SPO2-3',
        fullName: 'HN****1054',
        age: 62,
        gender: 'male',
        triageLevel: 'urgent',
        arrivalTime: new Date().toISOString(),
        chiefComplaint: 'เหนื่อยหอบ',
        allergies: [],
        currentRiskLevel: 'low_medium',
        latestNewsScore: newsSpo2.totalScore,
        latestVitals: vitalsSpo2Critical,
        latestNewsResult: newsSpo2,
        hasSepsisAlert: false,
        attendingPhysician: null,
        primaryNurse: null,
        location: 'ER',
      };

      const unrelatedSelected: Patient = {
        ...spo2Patient,
        id: '000692457',
        hn: '000692457',
        vn: 'VN-OTHER-8',
        fullName: 'HN****2457',
        latestNewsScore: 8,
        latestVitals: { ...baseVitals, respiratoryRate: 22, spO2: 95, oxygenSupplementation: 'supplemental', temperature: 38.5, systolicBP: 108, heartRate: 104 },
        latestNewsResult: calculateNEWS({ ...baseVitals, respiratoryRate: 22, spO2: 95, oxygenSupplementation: 'supplemental', temperature: 38.5, systolicBP: 108, heartRate: 104 }),
        hasSepsisAlert: true,
      };
      expect(hasCriticalSingleParam(unrelatedSelected.latestNewsResult)).toBe(false);

      // 1. Even if alerted patient disappeared from patients[], snapshot resolves to spo2Patient (never unrelatedSelected)
      const modalData = buildSingleParamModalData(spo2Patient) as any;
      const resolvedFromSnapshot = resolveSingleParamAlertTarget(modalData, [unrelatedSelected], unrelatedSelected);
      expect(resolvedFromSnapshot.patient?.hn).toBe('000391054');
      expect(resolvedFromSnapshot.alertNewsScore).toBe(3);

      // 2. Without snapshot and missing from patients[], does NOT cross-fallback to unrelatedSelected
      const resolvedMissing = resolveSingleParamAlertTarget(
        { hn: '000391054', newsScore: 3, patientName: 'HN****1054' },
        [unrelatedSelected],
        unrelatedSelected
      );
      expect(resolvedMissing.patient).toBeUndefined();

      // 3. SingleParamAlertModalContent displays SpO2 prefix and red highlight for SpO2 70% (+3)
      const html = renderToStaticMarkup(
        createElement(SingleParamAlertModalContent, {
          patient: spo2Patient,
          alertHN: spo2Patient.hn,
          alertNewsScore: spo2Patient.latestNewsScore,
          onAcknowledge: () => {},
          onAssessPending: () => {},
          onClose: () => {},
        })
      );
      expect(html).toContain('SpO₂ 70%');
      expect(html).toContain('ความอิ่มตัวออกซิเจน (SpO₂): 70%');
      expect(html).toContain('data-critical-param="true"');

      // 4. selectPatient must NOT clobber an active single_param_alert modal with avpu_assessment
      const unassessedSpo2Patient: Patient = {
        ...spo2Patient,
        id: '000999111',
        hn: '000999111',
        latestVitals: { ...vitalsSpo2Critical, oxygenSupplementation: 'unassessed' },
        latestNewsResult: calculateNEWS({ ...vitalsSpo2Critical, oxygenSupplementation: 'unassessed' }),
      };
      useRTSASStore.setState({ patients: [unassessedSpo2Patient], selectedPatient: null });
      useRTSASStore.getState().openModal('single_param_alert', buildSingleParamModalData(unassessedSpo2Patient));
      useRTSASStore.getState().selectPatient('000999111');
      expect(useRTSASStore.getState().ui.modal.activeModal).toBe('single_param_alert');
    });
  });
});
