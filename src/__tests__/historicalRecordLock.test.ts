import { describe, it, expect, beforeEach } from 'vitest';
import { useRTSASStore, isHistoricalPatient } from '../store/useRTSASStore';
import type { Patient } from '../types';

const mockHistoricalPatient: Patient = {
  id: 'P_HIST_01',
  hn: '100099',
  vn: 'VN100099',
  triageLevel: 'emergency',
  fullName: 'นายประวัติ ย้อนหลัง',
  gender: 'male',
  age: 65,
  arrivalTime: '2026-09-01T08:00:00Z', // Past date
  chiefComplaint: 'มีไข้ หนาวสั่น ซึม',
  allergies: [],
  currentRiskLevel: 'high',
  latestNewsScore: 7,
  latestVitals: {
    respiratoryRate: 24,
    spO2: 92,
    temperature: 38.9,
    systolicBP: 88,
    heartRate: 115,
    gcs: 15,
    avpu: 'A',
    oxygenSupplementation: 'room_air',
  },
  latestNewsResult: null,
  hasSepsisAlert: true,
  attendingPhysician: null,
  primaryNurse: null,
  location: 'ER Bed 01',
  treatmentStatus: {
    hn: '100099',
    acknowledged: true,
    doctor_confirmed: true,
    countdown_duration: 3600,
    treatment_completed: true,
    treatment_completed_at: '2026-09-01T08:45:00Z',
    treatment_completed_by: 'นพ.สมชาย',
    sepsis_ruled_out: false,
  },
};

const mockActiveTodayPatient: Patient = {
  id: 'P_ACTIVE_01',
  hn: '200001',
  vn: 'VN200001',
  triageLevel: 'emergency',
  fullName: 'นางสาวฉุกเฉิน วันนี้',
  gender: 'female',
  age: 42,
  arrivalTime: new Date().toISOString(), // Today
  chiefComplaint: 'ไข้สูง หายใจเร็ว',
  allergies: [],
  currentRiskLevel: 'high',
  latestNewsScore: 6,
  latestVitals: {
    respiratoryRate: 22,
    spO2: 94,
    temperature: 38.5,
    systolicBP: 95,
    heartRate: 105,
    gcs: 15,
    avpu: 'A',
    oxygenSupplementation: 'room_air',
  },
  latestNewsResult: null,
  hasSepsisAlert: true,
  attendingPhysician: null,
  primaryNurse: null,
  location: 'ER Bed 02',
  treatmentStatus: {
    hn: '200001',
    acknowledged: false,
    doctor_confirmed: false,
    countdown_duration: 3600,
    treatment_completed: false,
    sepsis_ruled_out: false,
  },
};

describe('Historical Patient Record Locking & Audit Trail', () => {
  beforeEach(() => {
    useRTSASStore.setState({
      patients: [mockHistoricalPatient, mockActiveTodayPatient],
      selectedPatient: null,
      patientData: {},
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
      treatmentCompleted: false,
    });
  });

  it('correctly identifies historical vs active patients', () => {
    expect(isHistoricalPatient(mockHistoricalPatient)).toBe(true);
    expect(isHistoricalPatient(mockActiveTodayPatient)).toBe(false);
  });

  it('identifies patient with treatment completed as historical even if visited today', () => {
    const todayCompletedPatient: Patient = {
      ...mockActiveTodayPatient,
      treatmentStatus: {
        ...mockActiveTodayPatient.treatmentStatus!,
        treatment_completed: true,
      },
    };
    expect(isHistoricalPatient(todayCompletedPatient)).toBe(true);
  });

  it('identifies patient with sepsis ruled out as historical', () => {
    const todayRuledOutPatient: Patient = {
      ...mockActiveTodayPatient,
      treatmentStatus: {
        ...mockActiveTodayPatient.treatmentStatus!,
        sepsis_ruled_out: true,
      },
    };
    expect(isHistoricalPatient(todayRuledOutPatient)).toBe(true);
  });

  it('blocks checklist modifications on historical patient', () => {
    useRTSASStore.getState().selectPatient(mockHistoricalPatient.id);
    const initialChecklist = useRTSASStore.getState().checklist;
    const hemocultureItem = initialChecklist
      .flatMap((p) => p.items)
      .find((i) => i.id === 'hemoculture');

    expect(hemocultureItem?.status).not.toBe('completed');

    // Attempt to tick checklist on historical patient
    useRTSASStore.getState().completeChecklistItem('hemoculture', 'Nurse Test');

    const updatedItem = useRTSASStore
      .getState()
      .checklist.flatMap((p) => p.items)
      .find((i) => i.id === 'hemoculture');

    // Must NOT be modified!
    expect(updatedItem?.status).toBe(hemocultureItem?.status);
  });

  it('blocks skipChecklistItem on historical patient', () => {
    useRTSASStore.getState().selectPatient(mockHistoricalPatient.id);
    useRTSASStore.getState().skipChecklistItem('antibiotics', 'Nurse Test');

    const item = useRTSASStore
      .getState()
      .checklist.flatMap((p) => p.items)
      .find((i) => i.id === 'antibiotics');

    expect(item?.status).not.toBe('skipped');
  });

  it('blocks ruleOutSepsis on historical patient', () => {
    useRTSASStore.getState().selectPatient(mockHistoricalPatient.id);
    const initialTimelineLength = useRTSASStore.getState().timeline.length;

    useRTSASStore.getState().ruleOutSepsis('Dr. Test');

    expect(useRTSASStore.getState().timeline.length).toBe(initialTimelineLength);
  });

  it('blocks completeTreatment on historical patient', () => {
    useRTSASStore.getState().selectPatient(mockHistoricalPatient.id);
    const initialTimelineLength = useRTSASStore.getState().timeline.length;

    useRTSASStore.getState().completeTreatment('Dr. Test');

    expect(useRTSASStore.getState().timeline.length).toBe(initialTimelineLength);
  });

  it('does not start countdown timer on historical patient', () => {
    useRTSASStore.getState().selectPatient(mockHistoricalPatient.id);
    useRTSASStore.getState().startCountdown(new Date().toISOString());

    expect(useRTSASStore.getState().countdownTimer.isActive).toBe(false);
  });

  it('tickCountdown keeps historical countdownTimer inactive', () => {
    useRTSASStore.getState().selectPatient(mockHistoricalPatient.id);
    useRTSASStore.getState().tickCountdown();

    expect(useRTSASStore.getState().countdownTimer.isActive).toBe(false);
  });

  it('allows treatment actions for active ER patients even if arrival date is yesterday', () => {
    const mockActiveYesterdayPatient: Patient = {
      id: 'P_ACTIVE_YESTERDAY',
      hn: '200002',
      vn: 'VN200002',
      triageLevel: 'emergency',
      fullName: 'นายคนไข้ เมื่อวานยังรักษาอยู่',
      gender: 'male',
      age: 50,
      arrivalTime: '2026-09-12T10:00:00Z', // Yesterday
      chiefComplaint: 'ไข้สูง หอบเหนื่อย',
      allergies: [],
      currentRiskLevel: 'high',
      latestNewsScore: 6,
      latestVitals: {
        respiratoryRate: 22,
        spO2: 94,
        temperature: 38.5,
        systolicBP: 95,
        heartRate: 105,
        gcs: 15,
        avpu: 'A',
        oxygenSupplementation: 'room_air',
      },
      latestNewsResult: null,
      hasSepsisAlert: true,
      attendingPhysician: null,
      primaryNurse: null,
      location: 'ER Bed 03',
      treatmentStatus: {
        hn: '200002',
        acknowledged: false,
        doctor_confirmed: false,
        countdown_duration: 3600,
        treatment_completed: false,
        sepsis_ruled_out: false,
      },
    };

    // Before treatment, active ER patient is NOT historical
    expect(isHistoricalPatient(mockActiveYesterdayPatient)).toBe(false);

    useRTSASStore.setState({
      patients: [mockActiveYesterdayPatient],
    });
    useRTSASStore.getState().selectPatient(mockActiveYesterdayPatient.id);
    expect(useRTSASStore.getState().checklist.length).toBeGreaterThan(0);

    // 1. Can complete checklist item
    useRTSASStore.getState().completeChecklistItem('triage', 'Nurse Test');
    const triageItem = useRTSASStore
      .getState()
      .checklist.flatMap((p) => p.items)
      .find((i) => i.id === 'triage');
    expect(triageItem?.status).toBe('completed');

    // 2. Can start countdown timer
    const now = new Date().toISOString();
    useRTSASStore.getState().startCountdown(now);
    expect(useRTSASStore.getState().countdownTimer.isActive).toBe(true);

    // 3. Can complete treatment
    useRTSASStore.getState().completeTreatment('Dr. Test');
    expect(useRTSASStore.getState().treatmentCompleted).toBe(true);
    expect(useRTSASStore.getState().countdownTimer.isActive).toBe(false);

    // 4. Once completed, patient is strictly locked as historical record
    expect(isHistoricalPatient(mockActiveYesterdayPatient, useRTSASStore.getState().patientData)).toBe(true);
  });

  it('locks patient when opened as historical archive from dashboard', () => {
    const mockUncompletedArchivePatient: Patient = {
      ...mockActiveTodayPatient,
      id: 'P_ARCHIVE_01',
      hn: '200003',
    };

    useRTSASStore.setState({
      patients: [mockUncompletedArchivePatient],
    });

    // When opened from TreatedDashboard, isHistoricalArchive is true
    useRTSASStore.getState().selectPatient(mockUncompletedArchivePatient.id, true);
    expect(isHistoricalPatient(mockUncompletedArchivePatient, useRTSASStore.getState().patientData)).toBe(true);

    // Checklist modification must be blocked
    useRTSASStore.getState().completeChecklistItem('triage', 'Nurse Test');
    const triageItem = useRTSASStore
      .getState()
      .checklist.flatMap((p) => p.items)
      .find((i) => i.id === 'triage');
    expect(triageItem?.status).not.toBe('completed');
  });
});
