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
    useRTSASStore.getState().completeChecklistItem('nurse_reassess', 'Nurse Test');
    const reassessItem = useRTSASStore
      .getState()
      .checklist.flatMap((p) => p.items)
      .find((i) => i.id === 'nurse_reassess');
    expect(reassessItem?.status).toBe('completed');

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
    useRTSASStore.getState().completeChecklistItem('nurse_reassess', 'Nurse Test');
    const reassessItem = useRTSASStore
      .getState()
      .checklist.flatMap((p) => p.items)
      .find((i) => i.id === 'nurse_reassess');
    expect(reassessItem?.status).not.toBe('completed');
  });

  it('tickCountdown stops timer and does not decrement remainingSeconds when treatmentCompleted or sepsisRuledOut is true', () => {
    const startedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const initialRemaining = 3000;

    useRTSASStore.setState({
      patients: [mockActiveTodayPatient],
      selectedPatient: mockActiveTodayPatient,
      treatmentCompleted: true,
      countdownTimer: {
        isActive: true,
        startedAt,
        totalDurationSeconds: 3600,
        remainingSeconds: initialRemaining,
        isExpired: false,
        isWarning: false,
        isCritical: false,
      },
      patientData: {
        [mockActiveTodayPatient.id]: {
          checklist: [],
          timeline: [],
          countdownTimer: {
            isActive: true,
            startedAt,
            totalDurationSeconds: 3600,
            remainingSeconds: initialRemaining,
            isExpired: false,
            isWarning: false,
            isCritical: false,
          },
          assessmentSchedule: null,
          sepsisRuledOut: false,
          ruledOutAt: null,
          ruledOutBy: null,
          treatmentCompleted: true,
          treatmentCompletedAt: new Date().toISOString(),
        },
      },
    });

    useRTSASStore.getState().tickCountdown();

    const stateAfterComplete = useRTSASStore.getState();
    expect(stateAfterComplete.countdownTimer.isActive).toBe(false);
    expect(stateAfterComplete.countdownTimer.remainingSeconds).toBe(initialRemaining);
    expect(stateAfterComplete.patientData[mockActiveTodayPatient.id].countdownTimer.isActive).toBe(false);
    expect(stateAfterComplete.patientData[mockActiveTodayPatient.id].countdownTimer.remainingSeconds).toBe(initialRemaining);

    // Also verify sepsisRuledOut stops active timers without decrementing
    useRTSASStore.setState({
      treatmentCompleted: false,
      sepsisRuledOut: true,
      countdownTimer: {
        isActive: true,
        startedAt,
        totalDurationSeconds: 3600,
        remainingSeconds: initialRemaining,
        isExpired: false,
        isWarning: false,
        isCritical: false,
      },
      patientData: {
        [mockActiveTodayPatient.id]: {
          checklist: [],
          timeline: [],
          countdownTimer: {
            isActive: true,
            startedAt,
            totalDurationSeconds: 3600,
            remainingSeconds: initialRemaining,
            isExpired: false,
            isWarning: false,
            isCritical: false,
          },
          assessmentSchedule: null,
          sepsisRuledOut: true,
          ruledOutAt: new Date().toISOString(),
          ruledOutBy: 'Dr. Test',
          treatmentCompleted: false,
          treatmentCompletedAt: null,
        },
      },
    });

    useRTSASStore.getState().tickCountdown();
    const stateAfterRuleOut = useRTSASStore.getState();
    expect(stateAfterRuleOut.countdownTimer.isActive).toBe(false);
    expect(stateAfterRuleOut.countdownTimer.remainingSeconds).toBe(initialRemaining);
    expect(stateAfterRuleOut.patientData[mockActiveTodayPatient.id].countdownTimer.isActive).toBe(false);
  });

  it('selectPatient keeps countdownTimer inactive for a same-day completed patient', () => {
    const completedTodayPatient: Patient = {
      ...mockActiveTodayPatient,
      id: 'P_TODAY_DONE',
      hn: '200099',
      treatmentStatus: {
        hn: '200099',
        acknowledged: true,
        doctor_confirmed: true,
        countdown_started_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        countdown_duration: 3600,
        treatment_completed: true,
        treatment_completed_at: new Date().toISOString(),
        sepsis_ruled_out: false,
      },
    };

    useRTSASStore.setState({
      patients: [completedTodayPatient],
    });

    useRTSASStore.getState().selectPatient(completedTodayPatient.id);
    const s = useRTSASStore.getState();
    expect(s.treatmentCompleted).toBe(true);
    expect(s.countdownTimer.isActive).toBe(false);
    expect(s.patientData[completedTodayPatient.id].countdownTimer.isActive).toBe(false);
  });
});

describe('Cross-day active patient retention in store', () => {
  it('retains unfinished previous-day active patient when setPatients only receives today arrivals', () => {
    const yesterdayIso = new Date(Date.now() - 26 * 3600 * 1000).toISOString();
    const prevDayActive: Patient = {
      ...mockActiveTodayPatient,
      id: 'P_XDAY_ACT_1',
      hn: '900001',
      arrivalTime: yesterdayIso,
      treatmentStatus: {
        hn: '900001',
        acknowledged: true,
        doctor_confirmed: false,
        treatment_completed: false,
        sepsis_ruled_out: false,
      },
    };
    const prevDayIdle: Patient = {
      ...mockActiveTodayPatient,
      id: 'P_XDAY_IDLE_1',
      hn: '900002',
      arrivalTime: yesterdayIso,
      treatmentStatus: undefined,
    };
    const prevDayArchived: Patient = {
      ...mockActiveTodayPatient,
      id: 'P_XDAY_ARCH_1',
      hn: '900003',
      arrivalTime: yesterdayIso,
      treatmentStatus: undefined,
    };
    const todayArrival: Patient = {
      ...mockActiveTodayPatient,
      id: 'P_TODAY_NEW_1',
      hn: '900099',
      arrivalTime: new Date().toISOString(),
    };

    useRTSASStore.setState({
      patients: [prevDayActive, prevDayIdle, prevDayArchived],
      selectedPatient: prevDayActive,
      patientData: {
        P_XDAY_ACT_1: {
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
          acknowledged: true,
          treatmentCompleted: false,
          sepsisRuledOut: false,
        },
        P_XDAY_ARCH_1: {
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
          isHistoricalArchive: true,
          treatmentCompleted: false,
          sepsisRuledOut: false,
        },
      },
    });

    // Simulate midnight/next-day poll returning only today's arrival
    useRTSASStore.getState().setPatients([todayArrival]);

    const idsAfter = useRTSASStore.getState().patients.map((p) => p.id);
    expect(idsAfter).toContain('P_TODAY_NEW_1');
    expect(idsAfter).toContain('P_XDAY_ACT_1');
    expect(idsAfter).not.toContain('P_XDAY_IDLE_1');
    expect(idsAfter).not.toContain('P_XDAY_ARCH_1');
  });

  it('drops previous-day active patient on next setPatients poll after completeTreatment or ruleOutSepsis', () => {
    const yesterdayIso = new Date(Date.now() - 28 * 3600 * 1000).toISOString();
    const prevDayCompleteTarget: Patient = {
      ...mockActiveTodayPatient,
      id: 'P_XDAY_FIN_1',
      hn: '900011',
      arrivalTime: yesterdayIso,
      treatmentStatus: {
        hn: '900011',
        acknowledged: true,
        doctor_confirmed: true,
        treatment_completed: false,
        sepsis_ruled_out: false,
      },
    };
    const prevDayRuleOutTarget: Patient = {
      ...mockActiveTodayPatient,
      id: 'P_XDAY_FIN_2',
      hn: '900012',
      arrivalTime: yesterdayIso,
      treatmentStatus: {
        hn: '900012',
        acknowledged: true,
        doctor_confirmed: false,
        treatment_completed: false,
        sepsis_ruled_out: false,
      },
    };
    const todayArrival: Patient = {
      ...mockActiveTodayPatient,
      id: 'P_TODAY_NEW_2',
      hn: '900100',
      arrivalTime: new Date().toISOString(),
    };

    useRTSASStore.setState({
      patients: [prevDayCompleteTarget, prevDayRuleOutTarget],
      selectedPatient: prevDayCompleteTarget,
      treatmentCompleted: false,
      sepsisRuledOut: false,
      patientData: {
        P_XDAY_FIN_1: {
          checklist: [],
          timeline: [],
          countdownTimer: {
            isActive: true,
            startedAt: yesterdayIso,
            totalDurationSeconds: 3600,
            remainingSeconds: 1800,
            isExpired: false,
            isWarning: false,
            isCritical: false,
          },
          assessmentSchedule: null,
          acknowledged: true,
          confirmedSepsis: true,
          treatmentCompleted: false,
          sepsisRuledOut: false,
        },
        P_XDAY_FIN_2: {
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
          acknowledged: true,
          treatmentCompleted: false,
          sepsisRuledOut: false,
        },
      },
    });

    // Complete first patient, select second patient and rule out sepsis
    useRTSASStore.getState().completeTreatment('Dr. Morning');
    useRTSASStore.getState().selectPatient('P_XDAY_FIN_2');
    useRTSASStore.getState().ruleOutSepsis('Dr. Morning');

    expect(useRTSASStore.getState().patientData.P_XDAY_FIN_1.treatmentCompleted).toBe(true);
    expect(useRTSASStore.getState().patientData.P_XDAY_FIN_2.sepsisRuledOut).toBe(true);

    // Subsequent backend poll omits finished previous-day cases -> store removes both
    useRTSASStore.getState().setPatients([todayArrival]);
    const remainingIds = useRTSASStore.getState().patients.map((p) => p.id);
    expect(remainingIds).toEqual(['P_TODAY_NEW_2']);
  });

  it('isHistoricalPatient checks both patient.id and patient.hn keys without misclassifying active cases', () => {
    const prevDayByHn: Patient = {
      ...mockActiveTodayPatient,
      id: 'VISIT_ROW_555',
      hn: '900555',
      arrivalTime: new Date(Date.now() - 30 * 3600 * 1000).toISOString(),
      treatmentStatus: undefined,
    };

    const baseData = {
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
      acknowledged: true,
      treatmentCompleted: false,
      sepsisRuledOut: false,
    };

    expect(isHistoricalPatient(prevDayByHn, { '900555': baseData })).toBe(false);
    expect(
      isHistoricalPatient(prevDayByHn, { '900555': { ...baseData, treatmentCompleted: true } })
    ).toBe(true);
    expect(
      isHistoricalPatient(prevDayByHn, { '900555': { ...baseData, isHistoricalArchive: true } })
    ).toBe(true);
  });
});
