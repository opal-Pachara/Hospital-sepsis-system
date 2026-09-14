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
    expect(hisText).toContain('ขั้นตอนที่ 4: ⏭ ข้าม: ยาปฏิชีวนะทางหลอดเลือดดำ ตัวที่ 2 (ถ้ามี) [ผู้ปฏิบัติ: ]');
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
});

