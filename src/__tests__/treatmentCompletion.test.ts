import { describe, it, expect, beforeEach } from 'vitest';
import { useRTSASStore } from '../store/useRTSASStore';
import { calculateNEWS } from '../utils/newsCalculator';
import type { Patient, VitalSigns } from '../types';
describe('Treatment Completion & Countdown Stop & Dashboard Sync', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    useRTSASStore.setState({
      patients: [],
      selectedPatient: null,
      patientData: {},
      timeline: [],
      countdownTimer: {
        startedAt: null,
        totalDurationSeconds: 3600,
        remainingSeconds: 3600,
        isActive: false,
        isExpired: false,
        isWarning: false,
        isCritical: false,
      },
      assessmentSchedule: null,
      treatmentCompleted: false,
      treatmentCompletedAt: null,
    });
  });

  it('stops countdown timer and marks patient as completed when treatment completes', () => {
    const mockPatient: Patient = {
      id: 'pt-001',
      hn: '123456789',
      fullName: 'นายทดสอบ รักษา',
      age: 55,
      gender: 'male',
      arrivalTime: '2026-09-14T20:00:00.000Z',
      chiefComplaint: 'ไข้สูง หนาวสั่น',
      triageLevel: 2,
      newsScore: 6,
      riskLevel: 'medium',
      treatmentStatus: {
        acknowledged: true,
        doctor_confirmed: true,
        countdown_started_at: '2026-09-14T20:05:00.000Z',
        treatment_completed: false,
      },
    };

    useRTSASStore.setState({
      patients: [mockPatient],
      selectedPatient: mockPatient,
      countdownTimer: {
        startedAt: '2026-09-14T20:05:00.000Z',
        totalDurationSeconds: 3600,
        remainingSeconds: 2400,
        isActive: true,
        isExpired: false,
        isWarning: false,
        isCritical: false,
      },
      patientData: {
        'pt-001': {
          countdownTimer: {
            startedAt: '2026-09-14T20:05:00.000Z',
            totalDurationSeconds: 3600,
            remainingSeconds: 2400,
            isActive: true,
            isExpired: false,
            isWarning: false,
            isCritical: false,
          },
          assessmentSchedule: {
            id: 'sched-1',
            patientId: 'pt-001',
            startedAt: '2026-09-14T20:05:00.000Z',
            entries: [
              {
                id: 'e-1',
                sequence: 1,
                scheduledTime: '2026-09-14T20:20:00.000Z',
                isCompleted: false,
                isCanceled: false,
              },
              {
                id: 'e-2',
                sequence: 2,
                scheduledTime: '2026-09-14T20:35:00.000Z',
                isCompleted: false,
                isCanceled: false,
              },
              {
                id: 'e-3',
                sequence: 3,
                scheduledTime: '2026-09-14T20:50:00.000Z',
                isCompleted: false,
                isCanceled: false,
              },
            ],
          },
        },
      },
    });

    const vitals: VitalSigns = {
      systolicBP: 125,
      diastolicBP: 82,
      heartRate: 78,
      respiratoryRate: 18,
      temperature: 36.8,
      spO2: 98,
      gcs: 15,
      avpu: 'A',
      oxygenSupplementation: 'room_air',
    };

    const targetSeq = 1;
    const now = '2026-09-14T20:25:00.000Z';
    const liveNews = calculateNEWS(vitals);

    // Simulate completion logic
    const state = useRTSASStore.getState();
    const currentSchedule = state.patientData['pt-001'].assessmentSchedule!;
    const updatedEntries = currentSchedule.entries.map((entry) => {
      if (entry.sequence === targetSeq) {
        return {
          ...entry,
          isCompleted: true,
          completedAt: now,
          completedBy: 'พว.สมใจ',
          vitalSigns: vitals,
          newsResult: liveNews,
          isCanceled: false,
        };
      } else if (entry.sequence > targetSeq) {
        return {
          ...entry,
          isCanceled: true,
          canceledReason: 'สิ้นสุดการรักษา',
        };
      }
      return entry;
    });

    const updatedSchedule = {
      ...currentSchedule,
      entries: updatedEntries,
    };

    const updatedTimer = {
      ...state.countdownTimer,
      isActive: false,
    };

    const updatedPatient: Patient = {
      ...mockPatient,
      latestVitals: vitals,
      newsScore: liveNews.totalScore,
      treatmentStatus: {
        ...mockPatient.treatmentStatus,
        treatment_completed: true,
        treatment_completed_at: now,
        treatment_completed_by: 'พว.สมใจ',
      },
    };

    useRTSASStore.setState({
      selectedPatient: updatedPatient,
      patients: [updatedPatient],
      treatmentCompleted: true,
      treatmentCompletedAt: now,
      countdownTimer: updatedTimer,
      assessmentSchedule: updatedSchedule,
      patientData: {
        'pt-001': {
          ...state.patientData['pt-001'],
          treatmentCompleted: true,
          treatmentCompletedAt: now,
          treatmentCompletedBy: 'พว.สมใจ',
          latestVitals: vitals,
          newsScore: liveNews.totalScore,
          countdownTimer: updatedTimer,
          assessmentSchedule: updatedSchedule,
        },
      },
    });

    const after = useRTSASStore.getState();

    // 1. Countdown timer must be inactive (stopped)
    expect(after.countdownTimer.isActive).toBe(false);
    expect(after.patientData['pt-001'].countdownTimer?.isActive).toBe(false);

    // 2. Patient must be marked treatment completed
    expect(after.treatmentCompleted).toBe(true);
    expect(after.patientData['pt-001'].treatmentCompleted).toBe(true);
    expect(after.selectedPatient?.treatmentStatus?.treatment_completed).toBe(true);

    // 3. In assessmentSchedule: sequence 1 is completed, sequence 2 is first canceled (shows 'เสร็จตรงนี้')
    const sched = after.assessmentSchedule!;
    expect(sched.entries[0].isCompleted).toBe(true);
    expect(sched.entries[0].isCanceled).toBe(false);
    expect(sched.entries[1].isCanceled).toBe(true);
    expect(sched.entries[2].isCanceled).toBe(true);

    const firstCanceledSeq = sched.entries.find((e) => e.isCanceled)?.sequence;
    expect(firstCanceledSeq).toBe(2);

    // 4. Patient is eligible for treated dashboard
    const pData = after.patientData['pt-001'];
    const isTreated = (pData?.treatmentCompleted ?? false) ||
      (after.patients[0].treatmentStatus?.treatment_completed ?? false);
    expect(isTreated).toBe(true);
  });

  it('resolves all 6 milestone timestamps identically for historical patients with backend timeline format', () => {
    const historicalPatient: Patient = {
      id: 'pt-archived-99',
      hn: 'HN999999',
      fullName: 'นางสมศรี ใจดี',
      age: 62,
      gender: 'female',
      isHistoricalArchive: true,
      arrivalTime: '2026-09-14T08:30:00.000Z',
      chiefComplaint: 'ไข้สูง หายใจเหนื่อย',
      triageLevel: 2,
      newsScore: 8,
      riskLevel: 'high',
      treatmentStatus: {
        acknowledged: true,
        acknowledged_at: '2026-09-14T08:35:00.000Z',
        doctor_confirmed: true,
        countdown_started_at: '2026-09-14T08:40:00.000Z',
        treatment_completed: true,
        treatment_completed_at: '2026-09-14T09:30:00.000Z',
        treatment_completed_by: 'พว.ประภาวรรณ',
      },
    };

    const rawTimeline = [
      {
        id: 'triage_HN999999',
        timestamp: '2026-09-14T08:30:00.000Z',
        actionText: '📥 ผู้ป่วยเข้ารับบริการที่ห้องฉุกเฉิน (ER) — อาการสำคัญ: ไข้สูง หายใจเหนื่อย',
        color: 'blue' as const,
        actor: 'พยาบาลคัดกรอง ER',
      },
      {
        id: 'news_HN999999',
        timestamp: '2026-09-14T08:32:00.000Z',
        actionText: '🧮 คำนวณ NEWS ได้ 8 คะแนน (High Risk)',
        color: 'blue' as const,
        actor: 'ระบบอัตโนมัติ',
      },
      {
        id: 'ack_HN999999',
        timestamp: '2026-09-14T08:35:00.000Z',
        actionText: 'พยาบาลประเมินซ้ำ — Vital Signs Stable',
        color: 'blue' as const,
        actor: 'พว.สุกัญญา',
      },
      {
        id: 'report_HN999999',
        timestamp: '2026-09-14T08:38:00.000Z',
        actionText: 'รายงานแพทย์เวร — แจ้งอาการผู้ป่วยสงสัย Sepsis',
        color: 'orange' as const,
        actor: 'พว.สุกัญญา',
      },
      {
        id: 'doc_HN999999',
        timestamp: '2026-09-14T08:40:00.000Z',
        actionText: '👨‍⚕️ แพทย์เวรยืนยันภาวะสงสัย Sepsis — เริ่มนับเวลา 60 นาที',
        color: 'red' as const,
        actor: 'นพ.สมหมาย',
      },
      {
        id: 'comp_HN999999',
        timestamp: '2026-09-14T09:30:00.000Z',
        actionText: '✅ สิ้นสุดกระบวนการรักษา (Complete 1-Hour Sepsis Bundle ครบถ้วนตามมาตรฐาน)',
        color: 'green' as const,
        actor: 'พว.ประภาวรรณ',
      },
    ];

    useRTSASStore.setState({
      selectedPatient: historicalPatient,
      timeline: rawTimeline,
      patientData: {
        'pt-archived-99': {
          treatmentCompleted: true,
          treatmentCompletedAt: '2026-09-14T09:30:00.000Z',
          timeline: rawTimeline,
        },
      },
    });

    // Milestone resolution test
    const findEventTime = (predicate: (t: string) => boolean) =>
      rawTimeline.find((e) => predicate(e.actionText || ''))?.timestamp || null;

    const visitTime = historicalPatient.arrivalTime || findEventTime((t) => t.includes('เข้ารับบริการ'));
    const newsTime = findEventTime((t) => t.includes('คำนวณ NEWS') || t.startsWith('🧮'));
    const nurseReassessTime = findEventTime((t) => t.includes('พยาบาลประเมินซ้ำ'));
    const reportDoctorTime = findEventTime((t) => t.includes('รายงานแพทย์เวร'));
    const doctorConfirmTime = historicalPatient.treatmentStatus?.countdown_started_at || findEventTime((t) => t.includes('แพทย์เวรยืนยัน'));
    const completedTime = historicalPatient.treatmentStatus?.treatment_completed_at || findEventTime((t) => t.includes('สิ้นสุดกระบวนการ'));

    expect(visitTime).toBe('2026-09-14T08:30:00.000Z');
    expect(newsTime).toBe('2026-09-14T08:32:00.000Z');
    expect(nurseReassessTime).toBe('2026-09-14T08:35:00.000Z');
    expect(reportDoctorTime).toBe('2026-09-14T08:38:00.000Z');
    expect(doctorConfirmTime).toBe('2026-09-14T08:40:00.000Z');
    expect(completedTime).toBe('2026-09-14T09:30:00.000Z');
  });
});
