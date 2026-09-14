const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const MANUAL_IMG_DIR = path.resolve(__dirname, '../docs/images/manual');
const ARTIFACT_DIR = '/Users/phatchara/.gemini/antigravity-ide/brain/012286c4-4fd3-4bd9-b9cb-b5a7de082131';

async function run() {
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
  await page.waitForTimeout(2000);

  // 1. Capture Auth Roles Modal (Doctor, Nurse, IT Admin)
  console.log('1. Capturing Auth Roles Modal...');
  await page.evaluate(() => {
    // Open login/register modal
    const btn = document.getElementById('btn-header-login');
    if (btn) btn.click();
  });
  await page.waitForTimeout(600);
  // Switch to Register tab to show role options
  await page.evaluate(() => {
    const regTabBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('สมัครสมาชิก'));
    if (regTabBtn) regTabBtn.click();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_1_1_auth_roles.png') });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '12_auth_login_modal_1789109769168.png') });

  // Close auth modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // 2. Select patient and prepare Phase 2 Doctor Decision UI
  console.log('2. Setting up Phase 2 Doctor Decision...');
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    const p = store.patients.find(pt => pt.hn.includes('0187')) || store.patients[0];
    store.selectPatient(p.id);

    // Complete Phase 1 items
    store.completeChecklistItem('triage', 'พย.สุกัญญา');
    store.completeChecklistItem('er_admission', 'พย.สุกัญญา');
    store.completeChecklistItem('initial_report', 'พย.สุกัญญา');

    // Ensure Phase 2 is unlocked
    const currentData = store.patientData[p.id];
    if (currentData) {
      currentData.sepsisRuledOut = false;
      currentData.treatmentCompleted = false;
    }
  });
  await page.waitForTimeout(600);

  // Crop or screenshot Checklist Panel for Phase 2
  const checklistEl = page.locator('#checklist-panel, .h-full.overflow-y-auto').first();
  console.log('Capturing fig_5_1_phase2_doctor_decision.png ...');
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_5_1_phase2_doctor_decision.png') });

  // 3. Complete Doctor Confirmation -> Phase 3 Hour-1 Sepsis Bundle Inputs
  console.log('3. Setting up Phase 3 Sepsis Bundle Inputs...');
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    const p = store.selectedPatient;
    if (!p) return;

    // Doctor confirms
    store.completeChecklistItem('doctor_confirm', 'นพ.เกียรติศักดิ์');
    
    // Fill hemoculture 1
    store.updateChecklistInput('hemoculture_1', 'Left median cubital vein');
  });
  await page.waitForTimeout(800);
  console.log('Capturing fig_5_2_phase3_bundle_inputs.png ...');
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_5_2_phase3_bundle_inputs.png') });

  // 4. Complete Phase 3 items and setup Phase 4 Assessment Schedule (Q15 rounds 1-4, Q30 round 5+)
  console.log('4. Setting up Phase 4 Assessment Schedule Table...');
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    const p = store.selectedPatient;
    if (!p) return;

    store.completeChecklistItem('hemoculture_1', 'พย.สุกัญญา', 'Left median cubital vein');
    store.completeChecklistItem('hemoculture_2', 'พย.สุกัญญา', 'Right cephalic vein');
    store.completeChecklistItem('iv_fluid', 'พย.สุกัญญา', 'NSS 1,000 ml IV load in 1 hr');
    store.completeChecklistItem('antibiotics_1', 'พย.สุกัญญา', 'Ceftriaxone 2g IV drip in 30 min');
    store.skipChecklistItem('antibiotics_2', 'พย.สุกัญญา'); // demonstrate skipped optional item
    store.skipChecklistItem('foley_cath', 'พย.สุกัญญา');

    // Create schedule: 4 rounds of Q15 + 2 rounds of Q30
    const now = Date.now();
    const entries = [
      {
        id: 'entry-1',
        sequence: 1,
        intervalType: 'Q15',
        scheduledTime: new Date(now - 45 * 60000).toISOString(),
        isCompleted: true,
        isCanceled: false,
        newsResult: { totalScore: 16, riskLevel: 'high' }
      },
      {
        id: 'entry-2',
        sequence: 2,
        intervalType: 'Q15',
        scheduledTime: new Date(now - 30 * 60000).toISOString(),
        isCompleted: true,
        isCanceled: false,
        newsResult: { totalScore: 12, riskLevel: 'high' }
      },
      {
        id: 'entry-3',
        sequence: 3,
        intervalType: 'Q15',
        scheduledTime: new Date(now - 15 * 60000).toISOString(),
        isCompleted: true,
        isCanceled: false,
        newsResult: { totalScore: 8, riskLevel: 'medium' }
      },
      {
        id: 'entry-4',
        sequence: 4,
        intervalType: 'Q15',
        scheduledTime: new Date(now).toISOString(),
        isCompleted: false,
        isCanceled: false,
        newsResult: null
      },
      {
        id: 'entry-5',
        sequence: 5,
        intervalType: 'Q30',
        scheduledTime: new Date(now + 30 * 60000).toISOString(),
        isCompleted: false,
        isCanceled: false,
        newsResult: null
      },
      {
        id: 'entry-6',
        sequence: 6,
        intervalType: 'Q30',
        scheduledTime: new Date(now + 60 * 60000).toISOString(),
        isCompleted: false,
        isCanceled: false,
        newsResult: null
      }
    ];

    const currentData = store.patientData[p.id];
    if (currentData) {
      currentData.assessmentSchedule = {
        id: 'sched-1',
        patientId: p.id,
        entries: entries,
      };
      // unlock phase 4
      const p4 = currentData.checklist.find(c => c.phase === 'assessment_schedule');
      if (p4) p4.isUnlocked = true;
    }
    store.assessmentSchedule = currentData.assessmentSchedule;
  });
  await page.waitForTimeout(800);
  console.log('Capturing fig_6_1_assessment_table_q15_q30.png ...');
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_6_1_assessment_table_q15_q30.png') });

  // 5. Open and populate AssessmentFormModal
  console.log('5. Setting up AssessmentFormModal...');
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    store.openModal('assessment_form', {
      entryId: 'entry-4',
      sequence: 4,
    });
  });
  await page.waitForTimeout(600);

  // Fill in vitals values to show live NEWS calculation and GCS->AVPU
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
  console.log('Capturing fig_6_2_assessment_form_modal.png ...');
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_6_2_assessment_form_modal.png') });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '10_assessment_form_modal_1789110284965.png') });

  // Close assessment modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // 6. Trigger ReminderModal (15-min alarm)
  console.log('6. Setting up ReminderModal...');
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    store.openModal('reminder', {
      entryId: 'entry-4',
      sequence: 4,
      scheduledTime: new Date().toISOString(),
    });
  });
  await page.waitForTimeout(600);
  console.log('Capturing fig_6_3_reminder_modal.png ...');
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_6_3_reminder_modal.png') });

  // Close reminder modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // 7. Trigger Treatment Complete Confirmation Dialog
  console.log('7. Setting up Treatment Complete Confirmation Dialog...');
  await page.evaluate(() => {
    const completeBtn = document.getElementById('btn-complete-treatment-checklist');
    if (completeBtn) completeBtn.click();
  });
  await page.waitForTimeout(600);
  console.log('Capturing fig_7_1_treatment_complete_modal.png ...');
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_7_1_treatment_complete_modal.png') });

  // Confirm treatment completion
  await page.evaluate(() => {
    const confirmBtn = document.getElementById('btn-confirm-complete-treatment-modal');
    if (confirmBtn) confirmBtn.click();
  });
  await page.waitForTimeout(800);

  // 8. Capture Treatment Completed State (Green Banner)
  console.log('8. Capturing Treatment Completed State...');
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_7_2_treatment_completed_state.png') });

  // 9. Switch to Timeline Tab and capture Clinical Timeline with HIS Copy button
  console.log('9. Capturing Clinical Timeline Panel...');
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    store.setActiveTab('timeline');
  });
  await page.waitForTimeout(800);
  console.log('Capturing fig_8_1_clinical_timeline_detail.png ...');
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_8_1_clinical_timeline_detail.png') });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '07_clinical_timeline_his_copy_1789109582922.png') });

  // 10. Navigate to Treated Cases Dashboard
  console.log('10. Navigating to Treated Cases Dashboard...');
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    const btn = document.getElementById('btn-filter-completed');
    if (btn) btn.click();
  });
  await page.waitForTimeout(1500);
  console.log('Capturing fig_9_1_treated_cases_dashboard.png ...');
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_9_1_treated_cases_dashboard.png') });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '13_treated_cases_dashboard_1789109878213.png') });

  // 11. Navigate to Admin Page
  console.log('11. Navigating to /admin ...');
  await page.goto('http://localhost:5174/admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  console.log('Capturing fig_10_1_admin_cache_panel.png ...');
  await page.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_10_1_admin_cache_panel.png') });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '14_admin_cache_management_1789109942141.png') });

  console.log('All functions captured successfully!');
  await browser.close();
}

run().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
