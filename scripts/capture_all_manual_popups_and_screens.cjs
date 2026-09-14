const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const MANUAL_IMG_DIR = path.resolve(__dirname, '../docs/images/manual');
if (!fs.existsSync(MANUAL_IMG_DIR)) {
  fs.mkdirSync(MANUAL_IMG_DIR, { recursive: true });
}

async function captureAll() {
  console.log('Launching browser with scale 2...');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1637, height: 936 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  console.log('Navigating to http://localhost:5174/ ...');
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Helper to ensure base mock patients in store
  const setupBasePatients = async () => {
    await page.evaluate(() => {
      const p1 = {
        id: 'P001',
        fullName: 'HN****0183',
        hn: 'HN****0183',
        vn: 'VN260911014',
        age: 63,
        gender: 'male',
        triageLevel: 'emergency',
        arrivalTime: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        chiefComplaint: 'ไข้สูง หนาวสั่น ซึมลง หายใจหอบเหนื่อย ความดันตก สงสัยติดเชื้อในกระแสเลือด (Septic Shock)',
        allergies: ['Penicillin'],
        currentRiskLevel: 'high',
        latestNewsScore: 16,
        latestVitals: {
          respiratoryRate: 26,
          spO2: 90,
          oxygenSupplementation: 'supplemental',
          temperature: 39.5,
          systolicBP: 86,
          heartRate: 126,
          gcs: 13,
          avpu: 'V',
        },
        latestNewsResult: {
          totalScore: 16,
          riskLevel: 'high',
          hasSingleParameterAlert: true,
          breakdown: [
            { parameter: 'respiratoryRate', score: 3, value: 26, displayValue: 'RR 26 bpm' },
            { parameter: 'spO2', score: 3, value: 90, displayValue: 'SpO₂ 90%' },
            { parameter: 'temperature', score: 2, value: 39.5, displayValue: 'TEMP 39.5°C' },
            { parameter: 'systolicBP', score: 3, value: 86, displayValue: 'SBP 86 mmHg' },
            { parameter: 'heartRate', score: 2, value: 126, displayValue: 'HR 126 bpm' },
            { parameter: 'consciousness', score: 3, value: 13, displayValue: 'GCS 13 (V)' },
          ],
        },
        hasSepsisAlert: true,
        attendingPhysician: 'นพ.เกียรติศักดิ์ อัศวรังสิมันต์',
        primaryNurse: 'พย.สุกัญญา มีชัย',
        location: 'ER-01',
      };

      const p2 = {
        id: 'P002',
        fullName: 'HN****0186',
        hn: 'HN****0186',
        vn: 'VN260911019',
        age: 70,
        gender: 'female',
        triageLevel: 'emergency',
        arrivalTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        chiefComplaint: 'ปัสสาวะแสบขัดสีขุ่น ไข้หนาวสั่น เพลียมาก หายใจเร็ว ความดันต่ำ สงสัย Urosepsis ติดเชื้อเข้ากระแสเลือด',
        allergies: [],
        currentRiskLevel: 'high',
        latestNewsScore: 14,
        latestVitals: {
          respiratoryRate: 24,
          spO2: 92,
          oxygenSupplementation: 'supplemental',
          temperature: 39.1,
          systolicBP: 92,
          heartRate: 118,
          gcs: 14,
          avpu: 'A',
        },
        latestNewsResult: {
          totalScore: 14,
          riskLevel: 'high',
          hasSingleParameterAlert: true,
          breakdown: [
            { parameter: 'respiratoryRate', score: 2, value: 24, displayValue: 'RR 24 bpm' },
            { parameter: 'spO2', score: 2, value: 92, displayValue: 'SpO₂ 92%' },
            { parameter: 'temperature', score: 2, value: 39.1, displayValue: 'TEMP 39.1°C' },
            { parameter: 'systolicBP', score: 2, value: 92, displayValue: 'SBP 92 mmHg' },
            { parameter: 'heartRate', score: 2, value: 118, displayValue: 'HR 118 bpm' },
            { parameter: 'consciousness', score: 3, value: 14, displayValue: 'GCS 14 (V)' },
          ],
        },
        hasSepsisAlert: true,
        attendingPhysician: null,
        primaryNurse: 'พย.นิดา วงศ์สว่าง',
        location: 'ER-02',
      };

      window.__rtsas_store.setState({
        patients: [p1, p2],
        selectedPatient: p1,
        ui: {
          ...window.__rtsas_store.getState().ui,
          selectedPatientId: p1.id,
        },
      });
    });
  };

  await setupBasePatients();
  await page.waitForTimeout(500);

  // =========================================================================
  // POPUP 1: Single Sepsis Alert Modal (🚨 🔴 แจ้งเตือนฉุกเฉิน)
  // =========================================================================
  console.log('Capturing pop_01_sepsis_alert_modal.png ...');
  await page.evaluate(() => {
    window.__rtsas_store.getState().openModal('alert', {
      hn: 'HN****0183',
      newsScore: 16,
      patientName: 'HN****0183',
    });
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'pop_01_sepsis_alert_modal.png') });
  // Also keep backward compatibility
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, '03_sepsis_alert_modal.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // =========================================================================
  // POPUP 2: Multi-Alert Queue Modal (🚨 คิวผู้ป่วยวิกฤตหลายราย)
  // =========================================================================
  console.log('Capturing pop_02_multi_alert_queue.png ...');
  await page.evaluate(() => {
    window.__rtsas_store.setState({
      pendingAlerts: [
        { hn: 'HN****0183', newsScore: 16, timestamp: Date.now() },
        { hn: 'HN****0186', newsScore: 14, timestamp: Date.now() },
      ],
    });
    window.__rtsas_store.getState().openModal('multi_alert');
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'pop_02_multi_alert_queue.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, '04_multi_alert_queue.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // =========================================================================
  // POPUP 3: Vital Signs Reassessment Reminder Modal (🔔 กระดิ่งเตือนรอบประเมินซ้ำ)
  // =========================================================================
  console.log('Capturing pop_03_reassessment_reminder.png ...');
  await page.evaluate(() => {
    window.__rtsas_store.getState().openModal('reminder', {
      entryId: 'entry-4',
      sequence: 4,
      scheduledTime: new Date(Date.now() - 2 * 60000).toISOString(),
    });
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'pop_03_reassessment_reminder.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_6_3_reminder_modal.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // =========================================================================
  // POPUP 4: Assessment Form Modal (📝 แบบฟอร์มบันทึกสัญญาณชีพซ้ำและคำนวณ NEWS สด)
  // =========================================================================
  console.log('Capturing pop_04_assessment_form.png ...');
  await page.evaluate(() => {
    window.__rtsas_store.getState().openModal('assessment_form', {
      entryId: 'entry-4',
      sequence: 4,
    });
  });
  await page.waitForTimeout(600);
  // Fill in vitals values to demonstrate live calculation & GCS -> AVPU
  await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[type="number"]');
    // RR, SpO2, SBP, DBP, HR, BT, GCS
    const values = ['22', '93', '95', '60', '108', '38.8', '15'];
    inputs.forEach((inp, idx) => {
      if (values[idx]) {
        inp.value = values[idx];
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'pop_04_assessment_form.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, '06_assessment_form_modal.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_6_2_assessment_form_modal.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // =========================================================================
  // POPUP 5: Doctor Confirmation Dialog (🔬 ยืนยันภาวะติดเชื้อ Sepsis)
  // =========================================================================
  console.log('Capturing pop_05_doctor_confirm_dialog.png ...');
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    const p = store.selectedPatient;
    if (!p) return;
    // Complete Phase 1 items
    store.completeChecklistItem('triage', 'พย.สุกัญญา');
    store.completeChecklistItem('er_admission', 'พย.สุกัญญา');
    store.completeChecklistItem('initial_report', 'พย.สุกัญญา');
  });
  await page.waitForTimeout(500);
  // Click on "🔴 ยืนยัน — ติดเชื้อ" button in Phase 2 to reveal Confirm Yes Dialog
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b =>
      b.textContent.includes('ยืนยัน — ติดเชื้อ') || b.textContent.includes('ยืนยัน')
    );
    if (btn) btn.click();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'pop_05_doctor_confirm_dialog.png') });

  // =========================================================================
  // POPUP 6: Doctor Rule Out Dialog (🛑 ยืนยันไม่ใช่ Sepsis / Rule Out)
  // =========================================================================
  console.log('Capturing pop_06_doctor_rule_out_dialog.png ...');
  // Click cancel or toggle to Rule Out
  await page.evaluate(() => {
    const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('ยกเลิก'));
    if (cancelBtn) cancelBtn.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const btnNo = Array.from(document.querySelectorAll('button')).find(b =>
      b.textContent.includes('ไม่ยืนยัน — Rule Out') || b.textContent.includes('Rule Out')
    );
    if (btnNo) btnNo.click();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'pop_06_doctor_rule_out_dialog.png') });

  // Reset Phase 2 and confirm doctor confirmation to proceed to Phase 3 & 4
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('ยกเลิก'));
    if (cancelBtn) cancelBtn.click();
    store.completeChecklistItem('doctor_confirm', 'นพ.เกียรติศักดิ์');
    // Set Phase 3 items
    store.updateChecklistInput('hemoculture_1', 'Left median cubital vein');
    store.completeChecklistItem('hemoculture_1', 'พย.สุกัญญา', 'Left median cubital vein');
    store.updateChecklistInput('hemoculture_2', 'Right cephalic vein');
    store.completeChecklistItem('hemoculture_2', 'พย.สุกัญญา', 'Right cephalic vein');
    store.updateChecklistInput('iv_fluid', 'NSS 1,000 ml IV load in 1 hr');
    store.completeChecklistItem('iv_fluid', 'พย.สุกัญญา', 'NSS 1,000 ml IV load in 1 hr');
    store.updateChecklistInput('antibiotics_1', 'Ceftriaxone 2g IV drip in 30 min');
    store.completeChecklistItem('antibiotics_1', 'พย.สุกัญญา', 'Ceftriaxone 2g IV drip in 30 min');
    store.skipChecklistItem('antibiotics_2', 'พย.สุกัญญา');
    store.skipChecklistItem('foley_cath', 'พย.สุกัญญา');
  });
  await page.waitForTimeout(600);

  // Setup Schedule entries for Phase 4
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    const p = store.selectedPatient;
    if (!p) return;
    const now = Date.now();
    const entries = [
      { id: 'entry-1', sequence: 1, intervalType: 'Q15', scheduledTime: new Date(now - 45 * 60000).toISOString(), isCompleted: true, isCanceled: false, newsResult: { totalScore: 16, riskLevel: 'high' } },
      { id: 'entry-2', sequence: 2, intervalType: 'Q15', scheduledTime: new Date(now - 30 * 60000).toISOString(), isCompleted: true, isCanceled: false, newsResult: { totalScore: 12, riskLevel: 'high' } },
      { id: 'entry-3', sequence: 3, intervalType: 'Q15', scheduledTime: new Date(now - 15 * 60000).toISOString(), isCompleted: true, isCanceled: false, newsResult: { totalScore: 8, riskLevel: 'medium' } },
      { id: 'entry-4', sequence: 4, intervalType: 'Q15', scheduledTime: new Date(now).toISOString(), isCompleted: false, isCanceled: false, newsResult: null },
      { id: 'entry-5', sequence: 5, intervalType: 'Q30', scheduledTime: new Date(now + 30 * 60000).toISOString(), isCompleted: false, isCanceled: false, newsResult: null },
      { id: 'entry-6', sequence: 6, intervalType: 'Q30', scheduledTime: new Date(now + 60 * 60000).toISOString(), isCompleted: false, isCanceled: false, newsResult: null },
    ];
    const currentData = store.patientData[p.id];
    if (currentData) {
      currentData.assessmentSchedule = { id: 'sched-1', patientId: p.id, entries: entries };
      const p4 = currentData.checklist.find(c => c.phase === 'assessment_schedule');
      if (p4) p4.isUnlocked = true;
    }
    store.assessmentSchedule = currentData.assessmentSchedule;
  });
  await page.waitForTimeout(600);

  // =========================================================================
  // POPUP 7: End of Treatment Confirmation Dialog (✅ ยืนยันการสิ้นสุดการรักษา)
  // =========================================================================
  console.log('Capturing pop_07_treatment_complete_modal.png ...');
  await page.evaluate(() => {
    const completeBtn = document.getElementById('btn-complete-treatment-checklist');
    if (completeBtn) completeBtn.click();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'pop_07_treatment_complete_modal.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_7_1_treatment_complete_modal.png') });

  // Cancel complete modal for now to take screen shots of active checklist
  await page.evaluate(() => {
    const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('ยกเลิก'));
    if (cancelBtn) cancelBtn.click();
  });
  await page.waitForTimeout(400);

  // =========================================================================
  // POPUP 8: Export Report Modal (📊 สรุปรายงานประจำกะและส่งออก)
  // =========================================================================
  console.log('Capturing pop_08_export_report_modal.png ...');
  await page.evaluate(() => {
    const exportBtn = document.getElementById('btn-header-export-report') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('ส่งออกรายงาน') || b.textContent.includes('รายงาน'));
    if (exportBtn) exportBtn.click();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'pop_08_export_report_modal.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, '07_export_report_modal.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // =========================================================================
  // POPUP 9: Auth Modal - Login Tab (🔐 หน้าต่างเข้าสู่ระบบแยก 3 บทบาท)
  // =========================================================================
  console.log('Capturing pop_09_auth_login_tab.png ...');
  await page.evaluate(() => {
    const loginBtn = document.getElementById('btn-header-login') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('เข้าสู่ระบบ') || b.textContent.includes('สลับผู้ใช้'));
    if (loginBtn) loginBtn.click();
  });
  await page.waitForTimeout(600);
  // Ensure on Login tab
  await page.evaluate(() => {
    const loginTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'เข้าสู่ระบบ');
    if (loginTab) loginTab.click();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'pop_09_auth_login_tab.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, '08_auth_login_modal.png') });

  // =========================================================================
  // POPUP 10: Auth Modal - Register Tab (📝 หน้าต่างสมัครสมาชิกบุคลากรใหม่)
  // =========================================================================
  console.log('Capturing pop_10_auth_register_tab.png ...');
  await page.evaluate(() => {
    const regTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('สมัครสมาชิก'));
    if (regTab) regTab.click();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'pop_10_auth_register_tab.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_1_1_auth_roles.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // =========================================================================
  // SCREEN 1: Main Clinical Dashboard Overview
  // =========================================================================
  console.log('Capturing scr_01_main_dashboard_layout.png ...');
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'scr_01_main_dashboard_layout.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, '01_main_dashboard.png') });

  // =========================================================================
  // SCREEN 2: Header Bar close-up
  // =========================================================================
  console.log('Capturing scr_02_header_bar.png ...');
  const headerEl = page.locator('header').first();
  if (await headerEl.count() > 0) {
    await headerEl.screenshot({ path: path.join(MANUAL_IMG_DIR, 'scr_02_header_bar.png') });
  }

  // =========================================================================
  // SCREEN 3: Sidebar Patient Queue
  // =========================================================================
  console.log('Capturing scr_03_sidebar_queue.png ...');
  const sidebarEl = page.locator('aside, .sidebar-queue, div:has(> #btn-filter-active)').first();
  if (await sidebarEl.count() > 0) {
    await sidebarEl.screenshot({ path: path.join(MANUAL_IMG_DIR, 'scr_03_sidebar_queue.png') });
    await sidebarEl.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_3_1_sidebar.png') });
  }

  // =========================================================================
  // SCREEN 4: Patient Detail & Vitals Grid
  // =========================================================================
  console.log('Capturing scr_04_patient_detail_vitals.png ...');
  const detailCol = page.locator('.detail-panel-col').first();
  if (await detailCol.count() > 0) {
    await detailCol.screenshot({ path: path.join(MANUAL_IMG_DIR, 'scr_04_patient_detail_vitals.png') });
    await detailCol.screenshot({ path: path.join(MANUAL_IMG_DIR, '02_patient_detail_vitals.png') });
  }

  // =========================================================================
  // SCREEN 5: NEWS Calculation Logic Table
  // =========================================================================
  console.log('Capturing scr_05_news_calculation_logic.png ...');
  const newsLogicEl = page.locator('div:has-text("NEWS Calculation Logic"), div:has-text("การคำนวณคะแนน NEWS")').first();
  if (await newsLogicEl.count() > 0) {
    await newsLogicEl.screenshot({ path: path.join(MANUAL_IMG_DIR, 'scr_05_news_calculation_logic.png') });
  }

  // =========================================================================
  // SCREEN 6: Sepsis Bundle Checklist Phase 1 & 2
  // =========================================================================
  console.log('Capturing scr_06_sepsis_bundle_phase1_2.png ...');
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'scr_06_sepsis_bundle_phase1_2.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_5_1_phase2_doctor_decision.png') });

  // =========================================================================
  // SCREEN 7: Sepsis Bundle Checklist Phase 3 Inputs
  // =========================================================================
  console.log('Capturing scr_07_sepsis_bundle_phase3.png ...');
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'scr_07_sepsis_bundle_phase3.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_5_2_phase3_bundle_inputs.png') });

  // =========================================================================
  // SCREEN 8: Reassessment Table (Phase 4)
  // =========================================================================
  console.log('Capturing scr_08_reassessment_table.png ...');
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'scr_08_reassessment_table.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_6_1_assessment_table_q15_q30.png') });

  // =========================================================================
  // Complete Treatment to capture Completed Banner & State
  // =========================================================================
  console.log('Capturing scr_09_treatment_completed_banner.png ...');
  await page.evaluate(() => {
    const completeBtn = document.getElementById('btn-complete-treatment-checklist');
    if (completeBtn) completeBtn.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const confirmBtn = document.getElementById('btn-confirm-complete-treatment-modal') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('ยืนยันสิ้นสุดการรักษา'));
    if (confirmBtn) confirmBtn.click();
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'scr_09_treatment_completed_banner.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_7_2_treatment_completed_state.png') });

  // =========================================================================
  // SCREEN 10: Clinical Timeline Panel with HIS Copy Button
  // =========================================================================
  console.log('Capturing scr_10_clinical_timeline_panel.png ...');
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    store.setActiveTab('timeline');
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'scr_10_clinical_timeline_panel.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, '05_clinical_timeline.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_8_1_clinical_timeline_detail.png') });

  // =========================================================================
  // SCREEN 11: Treated Dashboard Page
  // =========================================================================
  console.log('Capturing scr_11_treated_dashboard_page.png ...');
  await page.evaluate(() => {
    const btn = document.getElementById('btn-filter-completed') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('รักษาแล้ว'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'scr_11_treated_dashboard_page.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, '09_treated_cases_dashboard.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_9_1_treated_cases_dashboard.png') });

  // =========================================================================
  // POPUP 11: Treated Patient Timeline Modal (Inside Treated Dashboard)
  // =========================================================================
  console.log('Capturing pop_11_treated_case_timeline_modal.png ...');
  // Click on "ดูขั้นตอน / ไทม์ไลน์" on the first row of treated table
  await page.evaluate(() => {
    const viewTimelineBtn = Array.from(document.querySelectorAll('button')).find(b =>
      b.textContent.includes('ดูประวัติ') || b.textContent.includes('ขั้นตอน') || b.textContent.includes('ไทม์ไลน์')
    );
    if (viewTimelineBtn) viewTimelineBtn.click();
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'pop_11_treated_case_timeline_modal.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // =========================================================================
  // SCREEN 12: IT Admin Page
  // =========================================================================
  console.log('Capturing scr_12_admin_management_page.png ...');
  await page.goto('http://localhost:5174/admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'scr_12_admin_management_page.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, '10_admin_cache_management.png') });
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_10_1_admin_cache_panel.png') });

  // =========================================================================
  // POPUP 12: Admin Clear Cache Confirmation Dialog
  // =========================================================================
  console.log('Capturing pop_12_admin_clear_cache_modal.png ...');
  await page.evaluate(() => {
    const clearBtn = Array.from(document.querySelectorAll('button')).find(b =>
      b.textContent.includes('ล้างแคช') || b.textContent.includes('Clear Cache')
    );
    if (clearBtn) clearBtn.click();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'pop_12_admin_clear_cache_modal.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  console.log('✅ ALL SCREENSHOTS CAPTURED SUCCESSFULLY!');
  await browser.close();
}

captureAll().catch(err => {
  console.error('Capture error:', err);
  process.exit(1);
});
