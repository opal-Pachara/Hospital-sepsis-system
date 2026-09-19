import { describe, it, expect } from 'vitest';
import { isTreatmentTimelineEvent, useRTSASStore } from '../store/useRTSASStore';
import type { TimelineEvent } from '../types';

describe('isTreatmentTimelineEvent', () => {
  it('rejects connection, login, and authentication events', () => {
    const loginEvent: TimelineEvent = {
      id: '1',
      timestamp: new Date().toISOString(),
      actionText: '🔐 เข้าสู่ระบบ: Somchai Jaidee (พยาบาล)',
      color: 'blue',
      actor: 'Somchai Jaidee',
    };
    const logoutEvent: TimelineEvent = {
      id: '2',
      timestamp: new Date().toISOString(),
      actionText: '🔓 ออกจากระบบ: admin_it (สาธิต)',
      color: 'gray',
      actor: 'admin_it',
    };
    const hnRevealEvent: TimelineEvent = {
      id: '3',
      timestamp: new Date().toISOString(),
      actionText: '👁 เปิดดู HN เต็ม: HN3544 โดย Somchai Jaidee',
      color: 'blue',
      actor: 'Somchai Jaidee',
    };

    expect(isTreatmentTimelineEvent(loginEvent)).toBe(false);
    expect(isTreatmentTimelineEvent(logoutEvent)).toBe(false);
    expect(isTreatmentTimelineEvent(hnRevealEvent)).toBe(false);
  });

  it('rejects database and system alert notifications', () => {
    const newsAlertEvent: TimelineEvent = {
      id: '4',
      timestamp: new Date().toISOString(),
      actionText: '⚠️ ระบบตรวจพบ NEWS 7 — ต้องประเมินทันที',
      color: 'red',
      actor: 'System',
    };
    const vitalsUpdateEvent: TimelineEvent = {
      id: '5',
      timestamp: new Date().toISOString(),
      actionText: 'Vital signs updated — NEWS score: 8 (high)',
      color: 'red',
      actor: 'System',
    };

    expect(isTreatmentTimelineEvent(newsAlertEvent)).toBe(false);
    expect(isTreatmentTimelineEvent(vitalsUpdateEvent)).toBe(false);
  });

  it('rejects internal background scheduler and timer trigger events', () => {
    const scheduleEvent: TimelineEvent = {
      id: '6',
      timestamp: new Date().toISOString(),
      actionText: '📋 Assessment schedule generated (8 entries)',
      color: 'blue',
      actor: 'System',
    };
    const countdownEvent: TimelineEvent = {
      id: '7',
      timestamp: new Date().toISOString(),
      actionText: '⏱ 60-minute Sepsis Bundle countdown started',
      color: 'red',
      actor: 'Nurse',
    };
    const expiredEvent: TimelineEvent = {
      id: '8',
      timestamp: new Date().toISOString(),
      actionText: '⚠️ 60-minute Sepsis Bundle timer EXPIRED',
      color: 'red',
      actor: 'System',
    };

    expect(isTreatmentTimelineEvent(scheduleEvent)).toBe(false);
    expect(isTreatmentTimelineEvent(countdownEvent)).toBe(false);
    expect(isTreatmentTimelineEvent(expiredEvent)).toBe(false);
  });

  it('accepts valid clinical treatment and care procedure steps', () => {
    const triageEvent: TimelineEvent = {
      id: '9',
      timestamp: new Date().toISOString(),
      actionText: '✓ Triage Assessment Completed',
      color: 'blue',
      actor: 'Somchai Jaidee',
    };
    const erAdmissionEvent: TimelineEvent = {
      id: '10',
      timestamp: new Date().toISOString(),
      actionText: '✓ ER Admission Registered',
      color: 'blue',
      actor: 'Somchai Jaidee',
    };
    const doctorConfirmEvent: TimelineEvent = {
      id: '11',
      timestamp: new Date().toISOString(),
      actionText: '✓ Doctor Acknowledges Sepsis Alert & Starts Timer',
      color: 'blue',
      actor: 'Dr. Somsak',
    };
    const hemocultureEvent: TimelineEvent = {
      id: '12',
      timestamp: new Date().toISOString(),
      actionText: '✓ เจาะเลือดเพาะเชื้อ ครั้งที่ 1 — แขนขวา',
      color: 'blue',
      actor: 'Somchai Jaidee',
    };
    const skippedEvent: TimelineEvent = {
      id: '13',
      timestamp: new Date().toISOString(),
      actionText: '⏭ ข้าม: ยาปฏิชีวนะทางหลอดเลือดดำ ตัวที่ 2 (ถ้ามี)',
      color: 'blue',
      actor: 'Somchai Jaidee',
    };
    const assessmentEvent: TimelineEvent = {
      id: '14',
      timestamp: new Date().toISOString(),
      actionText: '📊 Assessment #1 completed — NEWS: 3',
      color: 'green',
      actor: 'Somchai Jaidee',
    };
    const completeTreatmentEvent: TimelineEvent = {
      id: '15',
      timestamp: new Date().toISOString(),
      actionText: '✅ สิ้นสุดการรักษา — ผู้ป่วยได้รับการรักษาครบถ้วนแล้ว',
      color: 'green',
      actor: 'Somchai Jaidee',
    };
    const ruledOutEvent: TimelineEvent = {
      id: '16',
      timestamp: new Date().toISOString(),
      actionText: '🟢 แพทย์ไม่ยืนยันภาวะติดเชื้อในกระแสเลือด — จบกระบวนการสำหรับผู้ป่วยรายนี้',
      color: 'green',
      actor: 'Dr. Somsak',
    };

    expect(isTreatmentTimelineEvent(triageEvent)).toBe(true);
    expect(isTreatmentTimelineEvent(erAdmissionEvent)).toBe(true);
    expect(isTreatmentTimelineEvent(doctorConfirmEvent)).toBe(true);
    expect(isTreatmentTimelineEvent(hemocultureEvent)).toBe(true);
    expect(isTreatmentTimelineEvent(skippedEvent)).toBe(true);
    expect(isTreatmentTimelineEvent(assessmentEvent)).toBe(true);
    expect(isTreatmentTimelineEvent(completeTreatmentEvent)).toBe(true);
    expect(isTreatmentTimelineEvent(ruledOutEvent)).toBe(true);
  });
});

describe('getTimelineText formatting for HIS', () => {
  it('formats clinical steps sequentially and includes total steps count', () => {
    const store = useRTSASStore.getState();
    store.clearTimeline();

    // Add a mix of events (attempt non-treatment and treatment)
    store.addTimelineEvent('🔐 เข้าสู่ระบบ: admin_it', 'blue', 'admin_it');
    store.addTimelineEvent('⚠️ ระบบตรวจพบ NEWS 8 — ต้องประเมินทันที', 'red', 'System');
    store.addTimelineEvent('✓ Triage Assessment Completed', 'blue', 'Somchai Jaidee');
    store.addTimelineEvent('✓ ER Admission Registered', 'blue', 'Somchai Jaidee');
    store.addTimelineEvent('✓ เจาะเลือดเพาะเชื้อ ครั้งที่ 1 — แขนซ้าย', 'blue', 'Somchai Jaidee');
    store.addTimelineEvent('⏭ ข้าม: ยาปฏิชีวนะทางหลอดเลือดดำ ตัวที่ 2 (ถ้ามี)', 'blue', 'Somchai Jaidee');

    const hisText = store.getTimelineText();

    // Verify non-treatment events are not in the text
    expect(hisText).not.toContain('เข้าสู่ระบบ');
    expect(hisText).not.toContain('ระบบตรวจพบ NEWS');

    // Verify treatment steps are numbered sequentially and have template for practitioner
    expect(hisText).toContain('ขั้นตอนที่ 1: ✓ Triage Assessment Completed [ผู้ปฏิบัติ: ]');
    expect(hisText).toContain('ขั้นตอนที่ 2: ✓ ER Admission Registered [ผู้ปฏิบัติ: ]');
    expect(hisText).toContain('ขั้นตอนที่ 3: ✓ เจาะเลือดเพาะเชื้อ ครั้งที่ 1 — แขนซ้าย [ผู้ปฏิบัติ: ]');
    expect(hisText).toContain('ขั้นตอนที่ 4 (ข้าม): ⏭ ข้าม: ยาปฏิชีวนะทางหลอดเลือดดำ ตัวที่ 2 (ถ้ามี) [ผู้ปฏิบัติ: ]');
    expect(hisText).not.toContain('พย.สุกัญญา');
    expect(hisText).toContain('รวมดำเนินการทั้งหมด: 4 ขั้นตอน');
  });

  it('calculates remaining countdown time from a custom clinical confirmation time', () => {
    const store = useRTSASStore.getState();
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    store.startCountdown(fifteenMinutesAgo);
    const timer = useRTSASStore.getState().countdownTimer;

    expect(timer.isActive).toBe(true);
    expect(timer.startedAt).toBe(fifteenMinutesAgo);
    // Remaining seconds should be around 45 mins (2700 seconds), allow 2-second test window
    expect(timer.remainingSeconds).toBeLessThanOrEqual(2701);
    expect(timer.remainingSeconds).toBeGreaterThanOrEqual(2698);
    expect(timer.isExpired).toBe(false);
  });

  it('marks timer as expired immediately if clinical confirmation was over 60 minutes ago', () => {
    const store = useRTSASStore.getState();
    const seventyMinutesAgo = new Date(Date.now() - 70 * 60 * 1000).toISOString();

    store.startCountdown(seventyMinutesAgo);
    const timer = useRTSASStore.getState().countdownTimer;

    expect(timer.isActive).toBe(true);
    expect(timer.remainingSeconds).toBe(0);
    expect(timer.isExpired).toBe(true);
  });

  it('cleans doctor confirmation timeline event so no doctor or operator name is displayed', () => {
    const store = useRTSASStore.getState();
    store.clearTimeline();

    store.addTimelineEvent(
      '✓ แพทย์ยืนยันภาวะติดเชื้อในกระแสเลือด (เวลาที่ยืนยันทางคลินิก: 14:54 น.) Somchaiomchai Jaidee',
      'blue',
      'Somchaiomchai Jaidee'
    );

    const hisText = store.getTimelineText();
    expect(hisText).toContain('ขั้นตอนที่ 1: ✓ แพทย์ยืนยันภาวะติดเชื้อในกระแสเลือด (เวลาที่ยืนยันทางคลินิก: 14:54 น.) [ผู้ปฏิบัติ: ]');
    expect(hisText).not.toContain('Somchaiomchai Jaidee');
  });

  it('keeps current patient selected on ruleOutSepsis, activates timeline tab, and isolates checklist from other patients', () => {
    const store = useRTSASStore.getState();
    
    // Set up two patients
    const patientA: any = {
      id: 'patient_A',
      hn: '111111111',
      fullName: 'นาย ก',
      currentRiskLevel: 'high',
      hasSepsisAlert: true,
      latestNewsScore: 6,
      arrivalTime: '2026-09-18T10:00:00',
    };
    const patientB: any = {
      id: 'patient_B',
      hn: '222222222',
      fullName: 'นาย ข',
      currentRiskLevel: 'high',
      hasSepsisAlert: true,
      latestNewsScore: 5,
      arrivalTime: '2026-09-18T10:30:00',
    };

    store.setPatients([patientA, patientB]);
    store.selectPatient('patient_A');

    // Complete Phase 1 on Patient A
    store.completeChecklistItem('triage', 'พยาบาล');
    store.completeChecklistItem('nurse_reassess', 'พยาบาล');
    store.completeChecklistItem('initial_report', 'พยาบาล');

    // Doctor rules out Sepsis on Patient A
    store.ruleOutSepsis('นพ.สมหมาย');

    const stateAfterRuleOut = useRTSASStore.getState();
    // 1. MUST remain on Patient A (never bounce to Patient B)
    expect(stateAfterRuleOut.selectedPatient?.id).toBe('patient_A');
    expect(stateAfterRuleOut.sepsisRuledOut).toBe(true);
    // 2. MUST switch activeTab to timeline
    expect(stateAfterRuleOut.ui.activeTab).toBe('timeline');
    // 3. Timeline MUST contain Rule Out event
    expect(stateAfterRuleOut.timeline.some((e) => e.actionText.includes('Rule Out'))).toBe(true);

    // Now manually switch to Patient B
    store.selectPatient('patient_B');
    const statePatientB = useRTSASStore.getState();

    // 4. Patient B MUST be clean: NOT ruled out, Phase 1 NOT completed, Phase 2 locked
    expect(statePatientB.selectedPatient?.id).toBe('patient_B');
    expect(statePatientB.sepsisRuledOut).toBe(false);
    
    const phase1Items = statePatientB.checklist.find((p) => p.phase === 'initial_response')?.items || [];
    const allPending = phase1Items.every((item) => item.status === 'pending');
    expect(allPending).toBe(true);

    const phase2Unlocked = statePatientB.checklist.find((p) => p.phase === 'doctor_confirmation')?.isUnlocked;
    expect(phase2Unlocked).toBe(false);
  });

  it('strictly isolates timelines when alerts for 2 patients are acknowledged sequentially', () => {
    const store = useRTSASStore.getState();

    const patient1: any = {
      id: 'pt_101',
      hn: '1010101',
      fullName: 'นาย หนึ่ง ทดสอบ',
      currentRiskLevel: 'high',
      hasSepsisAlert: true,
      latestNewsScore: 6,
      arrivalTime: '2026-09-18T11:00:00',
    };
    const patient2: any = {
      id: 'pt_102',
      hn: '2020202',
      fullName: 'นาง สอง ทดสอบ',
      currentRiskLevel: 'high',
      hasSepsisAlert: true,
      latestNewsScore: 7,
      arrivalTime: '2026-09-18T11:30:00',
    };

    store.setPatients([patient1, patient2]);

    // 1. Acknowledge Alert for Patient 1
    store.selectPatient('pt_101');
    store.startCountdown('2026-09-18T11:05:00', 'pt_101');
    store.addTimelineEvent(
      '🏥 ผู้ป่วยมาถึง ER เวลา 11:00 น.',
      'blue',
      'ระบบ',
      undefined,
      '2026-09-18T11:00:00',
      'pt_101'
    );
    store.addTimelineEvent(
      '🧮 ระบบคำนวณ NEWS Score = 6 (เสี่ยงสูง)',
      'red',
      'ระบบ RTSAS',
      undefined,
      '2026-09-18T11:02:00',
      'pt_101'
    );

    // 2. Alert popup for Patient 2 arrives and is acknowledged
    store.selectPatient('pt_102');
    store.startCountdown('2026-09-18T11:35:00', 'pt_102');
    store.addTimelineEvent(
      '🏥 ผู้ป่วยมาถึง ER เวลา 11:30 น.',
      'blue',
      'ระบบ',
      undefined,
      '2026-09-18T11:30:00',
      'pt_102'
    );
    store.addTimelineEvent(
      '🧮 ระบบคำนวณ NEWS Score = 7 (เสี่ยงสูง)',
      'red',
      'ระบบ RTSAS',
      undefined,
      '2026-09-18T11:32:00',
      'pt_102'
    );

    const currentStore = useRTSASStore.getState();
    const data1 = currentStore.patientData['pt_101'];
    const data2 = currentStore.patientData['pt_102'];

    expect(data1).toBeDefined();
    expect(data2).toBeDefined();

    // Patient 1 must have 11:00 / NEWS 6, NOT 11:30 / NEWS 7
    expect(data1.timeline.some((e) => e.actionText.includes('11:00'))).toBe(true);
    expect(data1.timeline.some((e) => e.actionText.includes('NEWS Score = 6'))).toBe(true);
    expect(data1.timeline.some((e) => e.actionText.includes('11:30'))).toBe(false);
    expect(data1.timeline.some((e) => e.actionText.includes('NEWS Score = 7'))).toBe(false);

    // Patient 2 must have 11:30 / NEWS 7, NOT 11:00 / NEWS 6
    expect(data2.timeline.some((e) => e.actionText.includes('11:30'))).toBe(true);
    expect(data2.timeline.some((e) => e.actionText.includes('NEWS Score = 7'))).toBe(true);
    expect(data2.timeline.some((e) => e.actionText.includes('11:00'))).toBe(false);
    expect(data2.timeline.some((e) => e.actionText.includes('NEWS Score = 6'))).toBe(false);

    // Switching between patients shows exclusively their own timeline
    store.selectPatient('pt_101');
    const timelineActive1 = useRTSASStore.getState().timeline;
    expect(timelineActive1.some((e) => e.actionText.includes('NEWS Score = 7'))).toBe(false);

    store.selectPatient('pt_102');
    const timelineActive2 = useRTSASStore.getState().timeline;
    expect(timelineActive2.some((e) => e.actionText.includes('NEWS Score = 6'))).toBe(false);
  });
});

describe('completeAssessment vital signs parameter timeline logging', () => {
  it('records full vital sign parameters (BP, HR, RR, SpO2, Temp, GCS/AVPU, NEWS) in timeline with correct color', () => {
    const store = useRTSASStore.getState();
    const patient: any = {
      id: 'pt_vs_test',
      hn: '333333333',
      fullName: 'นาย ทดสอบ สัญญาณชีพ',
      currentRiskLevel: 'low',
      hasSepsisAlert: true,
      latestNewsScore: 0,
      arrivalTime: '2026-09-18T10:00:00',
    };

    store.setPatients([patient]);
    store.selectPatient('pt_vs_test');
    store.generateSchedule('2026-09-18T10:00:00');

    const schedule = useRTSASStore.getState().assessmentSchedule!;
    const entry1 = schedule.entries[0];

    const normalVitals = {
      respiratoryRate: 20,
      spO2: 100,
      oxygenSupplementation: 'room_air' as const,
      temperature: 37,
      systolicBP: 120,
      diastolicBP: 80,
      heartRate: 80,
      gcs: 15,
      avpu: 'A' as const,
    };

    store.completeAssessment(entry1.id, normalVitals, 'พยาบาลวิชาชีพ');

    const state = useRTSASStore.getState();
    const timeline = state.timeline;
    const vsEvent = timeline.find((e) => e.actionText.includes('ประเมินสัญญาณชีพ (ครั้งที่ 1)'));

    expect(vsEvent).toBeDefined();
    expect(vsEvent?.color).toBe('green');
    expect(vsEvent?.actionText).toContain('BP 120/80 mmHg');
    expect(vsEvent?.actionText).toContain('HR 80 bpm');
    expect(vsEvent?.actionText).toContain('RR 20/min');
    expect(vsEvent?.actionText).toContain('SpO2 100%');
    expect(vsEvent?.actionText).toContain('Temp 37°C');
    expect(vsEvent?.actionText).toContain('GCS 15 (A)');
    expect(vsEvent?.actionText).toContain('(NEWS: 0 คะแนน - 🟢 ปกติ — NEWS = 0)');

    // Check HIS text format includes this entry
    const hisText = store.getTimelineText();
    expect(hisText).toContain('BP 120/80 mmHg, HR 80 bpm, RR 20/min, SpO2 100%, Temp 37°C, GCS 15 (A)');
    expect(hisText).toContain('[ผู้ปฏิบัติ: ]');
  });

  it('records high risk vital signs with red event color and urgency label', () => {
    const store = useRTSASStore.getState();
    const schedule = useRTSASStore.getState().assessmentSchedule!;
    const entry2 = schedule.entries[1];

    const criticalVitals = {
      respiratoryRate: 28,
      spO2: 91,
      oxygenSupplementation: 'room_air' as const,
      temperature: 39.2,
      systolicBP: 85,
      diastolicBP: 50,
      heartRate: 125,
      gcs: 14,
      avpu: 'V' as const,
    };

    store.completeAssessment(entry2.id, criticalVitals, 'พยาบาลวิชาชีพ');

    const state = useRTSASStore.getState();
    const timeline = state.timeline;
    const vsEvent = timeline.find((e) => e.actionText.includes('ประเมินสัญญาณชีพ (ครั้งที่ 2)'));

    expect(vsEvent).toBeDefined();
    expect(vsEvent?.color).toBe('red');
    expect(vsEvent?.actionText).toContain('BP 85/50 mmHg');
    expect(vsEvent?.actionText).toContain('HR 125 bpm');
    expect(vsEvent?.actionText).toContain('RR 28/min');
    expect(vsEvent?.actionText).toContain('SpO2 91%');
    expect(vsEvent?.actionText).toContain('Temp 39.2°C');
    expect(vsEvent?.actionText).toContain('GCS 14 (V)');
    expect(vsEvent?.actionText).toContain('🔴 สูง — ต้องการการดูแลเร่งด่วน');
  });
});


