import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateNEWS, scoreOxygenSupplementation } from '../utils/newsCalculator';
import { useRTSASStore } from '../store/useRTSASStore';
import { calculateMAP } from '../types';
import type { Patient, VitalSigns } from '../types';

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
});
