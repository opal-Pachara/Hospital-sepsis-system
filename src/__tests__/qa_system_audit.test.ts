import { describe, it, expect, beforeEach } from 'vitest';
import { calculateNEWS } from '../utils/newsCalculator';
import { maskHN } from '../utils/hnMask';
import { auditPatientMemory } from '../utils/patientMemory';
import { useRTSASStore, type PatientData } from '../store/useRTSASStore';
import type { Patient, VitalSigns } from '../types';

function createMockPatientData(overrides: Partial<PatientData> = {}): PatientData {
  return {
    checklist: [],
    timeline: [],
    countdownTimer: {
      isActive: false,
      startedAt: null,
      totalDurationSeconds: 3600,
      remainingSeconds: 3600,
      isExpired: false,
      isWarning: false,
      isCritical: false,
    },
    assessmentSchedule: null,
    sepsisRuledOut: false,
    ruledOutAt: null,
    ruledOutBy: null,
    treatmentCompleted: false,
    treatmentCompletedAt: null,
    ...overrides,
  };
}

const defaultVitals: VitalSigns = {
  respiratoryRate: 18,
  spO2: 98,
  oxygenSupplementation: 'room_air',
  temperature: 36.8,
  systolicBP: 120,
  heartRate: 75,
  gcs: 15,
  avpu: 'A',
};

function createPatient(id: string, hn: string, overrides: Partial<Patient> = {}): Patient {
  return {
    id,
    hn,
    vn: `VN-${id}`,
    fullName: `Patient ${id}`,
    age: 55,
    gender: 'male',
    triageLevel: 'emergency',
    arrivalTime: '2026-09-10T10:00:00.000Z',
    chiefComplaint: 'Sepsis screening',
    allergies: [],
    currentRiskLevel: 'high',
    latestNewsScore: 6,
    latestVitals: defaultVitals,
    latestNewsResult: null,
    hasSepsisAlert: true,
    attendingPhysician: null,
    primaryNurse: null,
    location: 'ER Resuscitation',
    ...overrides,
  };
}

describe('QA System Audit — Clinical Engine (NEWS2 & Edge Cases)', () => {
  it('correctly scores boundary values for Respiratory Rate (RR)', () => {
    // <=8 -> 3
    expect(calculateNEWS({ ...defaultVitals, respiratoryRate: 8 }).totalScore).toBe(3);
    // 9-11 -> 1
    expect(calculateNEWS({ ...defaultVitals, respiratoryRate: 9 }).totalScore).toBe(1);
    expect(calculateNEWS({ ...defaultVitals, respiratoryRate: 11 }).totalScore).toBe(1);
    // 12-20 -> 0
    expect(calculateNEWS({ ...defaultVitals, respiratoryRate: 12 }).totalScore).toBe(0);
    expect(calculateNEWS({ ...defaultVitals, respiratoryRate: 20 }).totalScore).toBe(0);
    // 21-24 -> 2
    expect(calculateNEWS({ ...defaultVitals, respiratoryRate: 21 }).totalScore).toBe(2);
    expect(calculateNEWS({ ...defaultVitals, respiratoryRate: 24 }).totalScore).toBe(2);
    // >=25 -> 3
    expect(calculateNEWS({ ...defaultVitals, respiratoryRate: 25 }).totalScore).toBe(3);
  });

  it('correctly scores boundary values for Oxygen Saturation (SpO2)', () => {
    // <=91 -> 3
    expect(calculateNEWS({ ...defaultVitals, spO2: 91 }).totalScore).toBe(3);
    // 92-93 -> 2
    expect(calculateNEWS({ ...defaultVitals, spO2: 92 }).totalScore).toBe(2);
    expect(calculateNEWS({ ...defaultVitals, spO2: 93 }).totalScore).toBe(2);
    // 94-95 -> 1
    expect(calculateNEWS({ ...defaultVitals, spO2: 94 }).totalScore).toBe(1);
    expect(calculateNEWS({ ...defaultVitals, spO2: 95 }).totalScore).toBe(1);
    // >=96 -> 0
    expect(calculateNEWS({ ...defaultVitals, spO2: 96 }).totalScore).toBe(0);
  });

  it('correctly scores boundary values for Temperature', () => {
    // <=35.0 -> 3
    expect(calculateNEWS({ ...defaultVitals, temperature: 35.0 }).totalScore).toBe(3);
    // 35.1-36.0 -> 1
    expect(calculateNEWS({ ...defaultVitals, temperature: 35.1 }).totalScore).toBe(1);
    expect(calculateNEWS({ ...defaultVitals, temperature: 36.0 }).totalScore).toBe(1);
    // 36.1-38.0 -> 0
    expect(calculateNEWS({ ...defaultVitals, temperature: 36.1 }).totalScore).toBe(0);
    expect(calculateNEWS({ ...defaultVitals, temperature: 38.0 }).totalScore).toBe(0);
    // 38.1-39.0 -> 1
    expect(calculateNEWS({ ...defaultVitals, temperature: 38.1 }).totalScore).toBe(1);
    expect(calculateNEWS({ ...defaultVitals, temperature: 39.0 }).totalScore).toBe(1);
    // >=39.1 -> 2
    expect(calculateNEWS({ ...defaultVitals, temperature: 39.1 }).totalScore).toBe(2);
  });

  it('correctly scores boundary values for Systolic BP', () => {
    // <=90 -> 3
    expect(calculateNEWS({ ...defaultVitals, systolicBP: 90 }).totalScore).toBe(3);
    // 91-100 -> 2
    expect(calculateNEWS({ ...defaultVitals, systolicBP: 91 }).totalScore).toBe(2);
    expect(calculateNEWS({ ...defaultVitals, systolicBP: 100 }).totalScore).toBe(2);
    // 101-110 -> 1
    expect(calculateNEWS({ ...defaultVitals, systolicBP: 101 }).totalScore).toBe(1);
    expect(calculateNEWS({ ...defaultVitals, systolicBP: 110 }).totalScore).toBe(1);
    // 111-219 -> 0
    expect(calculateNEWS({ ...defaultVitals, systolicBP: 111 }).totalScore).toBe(0);
    expect(calculateNEWS({ ...defaultVitals, systolicBP: 219 }).totalScore).toBe(0);
    // >=220 -> 3
    expect(calculateNEWS({ ...defaultVitals, systolicBP: 220 }).totalScore).toBe(3);
  });

  it('enforces single-parameter 3 alert trigger & clinical escalation', () => {
    // Patient has normal vitals everywhere except severe hypotension (SBP 80 -> 3)
    const result = calculateNEWS({ ...defaultVitals, systolicBP: 80 });
    expect(result.totalScore).toBe(3);
    expect(result.hasSingleParameterAlert).toBe(true);
    // Even though total score is 3 (<5), clinical risk must not be low
    expect(result.riskLevel).toBe('low_medium');
  });

  it('identifies consciousness impairment via GCS/AVPU mapping', () => {
    expect(calculateNEWS({ ...defaultVitals, gcs: 15, avpu: 'A' }).totalScore).toBe(0);
    // GCS < 15 mapped to AVPU 'V' scores 3 points for non-alert consciousness
    const altered = calculateNEWS({ ...defaultVitals, gcs: 14, avpu: 'V' });
    expect(altered.totalScore).toBe(3);
    expect(altered.hasSingleParameterAlert).toBe(true);
  });
});

describe('QA System Audit — Data Privacy & PDPA Compliance (HN Masking)', () => {
  it('safely masks standard HOSxP and hospital HN variants', () => {
    expect(maskHN('HN19086455')).toBe('HN****6455');
    expect(maskHN('HN-660001')).toBe('HN****0001');
    expect(maskHN('12345678')).toBe('HN****5678');
    expect(maskHN('HN001')).toBe('HN****0001');
    expect(maskHN('67000123')).toBe('HN****0123');
  });

  it('handles null, empty, and malformed inputs gracefully without crashing', () => {
    expect(maskHN('')).toBe('HN****');
    expect(maskHN(null as unknown as string)).toBe('HN****');
    expect(maskHN(undefined as unknown as string)).toBe('HN****');
    expect(maskHN('HN-')).toBe('HN****');
  });
});

describe('QA System Audit — Patient Memory Cleanup & Sepsis Guard', () => {
  beforeEach(() => {
    useRTSASStore.setState({
      patients: [],
      patientData: {},
      selectedPatient: null,
    });
  });

  it('auditPatientMemory classifies patients accurately based on clinical treatment state', () => {
    const p1 = createPatient('p1', 'HN001');
    const p2 = createPatient('p2', 'HN002');
    const p3 = createPatient('p3', 'HN003');

    const patientDataMap: Record<string, PatientData> = {
      p1: createMockPatientData({
        countdownTimer: {
          isActive: true,
          isExpired: false,
          remainingSeconds: 1800,
          totalDurationSeconds: 3600,
          startedAt: '2026-09-10T10:00:00Z',
          isWarning: false,
          isCritical: false,
        },
      }),
      p2: createMockPatientData({
        treatmentCompleted: true,
        treatmentCompletedAt: '2026-09-10T11:00:00Z',
      }),
      p3: createMockPatientData(),
    };

    const audit = auditPatientMemory(patientDataMap, [p1, p2, p3]);

    expect(audit.totalPatientsInMemory).toBe(3);
    expect(audit.activeTreatedCount).toBe(1);
    expect(audit.inactiveCount).toBe(2);
    expect(audit.retainedPatients.map((p) => p.hn)).toEqual(['HN001']);
    expect(audit.inactivePatients.length).toBe(2);
  });

  it('protects active patients while removing completed ones from store memory', () => {
    const pActive = createPatient('active-1', 'HN-ACTIVE');
    const pDone = createPatient('done-1', 'HN-DONE');
    const pIdle = createPatient('idle-1', 'HN-IDLE');

    useRTSASStore.setState({
      patients: [pActive, pDone, pIdle],
      patientData: {
        'active-1': createMockPatientData({
          countdownTimer: {
            isActive: true,
            isExpired: false,
            remainingSeconds: 2400,
            totalDurationSeconds: 3600,
            startedAt: '2026-09-10T10:00:00Z',
            isWarning: false,
            isCritical: false,
          },
        }),
        'done-1': createMockPatientData({
          treatmentCompleted: true,
          treatmentCompletedAt: '2026-09-10T11:00:00Z',
        }),
        'idle-1': createMockPatientData(),
      },
    });

    const result = useRTSASStore.getState().clearInactivePatientsMemory();

    expect(result.clearedCount).toBe(2);
    expect(result.retainedCount).toBe(1);
    expect(result.retainedPatients[0].hn).toBe('HN-ACTIVE');

    const currentStore = useRTSASStore.getState();
    // Only active patient retains memory in patientData
    expect(currentStore.patientData['active-1']).toBeDefined();
    expect(currentStore.patientData['done-1']).toBeUndefined();
    expect(currentStore.patientData['idle-1']).toBeUndefined();
  });
});
