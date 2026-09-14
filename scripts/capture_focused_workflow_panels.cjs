const { chromium } = require('playwright');
const path = require('path');

const MANUAL_IMG_DIR = path.resolve(__dirname, '../docs/images/manual');

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
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Select patient and prepare Phase 2 Doctor Decision UI
  console.log('1. Setting up Phase 2 Doctor Decision...');
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    const p = store.patients.find(pt => pt.hn.includes('0187')) || store.patients[0];
    store.selectPatient(p.id);
    store.setActiveTab('checklist');

    // Complete Phase 1 items
    store.completeChecklistItem('triage', 'พย.สุกัญญา');
    store.completeChecklistItem('er_admission', 'พย.สุกัญญา');
    store.completeChecklistItem('initial_report', 'พย.สุกัญญา');

    const currentData = store.patientData[p.id];
    if (currentData) {
      currentData.sepsisRuledOut = false;
      currentData.treatmentCompleted = false;
      // reset phase 2 item
      const p2 = currentData.checklist.find(c => c.phase === 'doctor_confirmation');
      if (p2) {
        p2.isUnlocked = true;
        p2.items[0].status = 'pending';
      }
    }
  });
  await page.waitForTimeout(800);
  const wfCol = page.locator('.workflow-panel-col').first();
  await wfCol.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_5_1_phase2_doctor_decision.png') });
  console.log('Saved focused fig_5_1_phase2_doctor_decision.png');

  // 2. Phase 3 Sepsis Bundle Inputs
  console.log('2. Setting up Phase 3 Sepsis Bundle Inputs...');
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    store.completeChecklistItem('doctor_confirm', 'นพ.เกียรติศักดิ์');
    store.updateChecklistInput('hemoculture_1', 'Left median cubital vein');
  });
  await page.waitForTimeout(800);
  await wfCol.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_5_2_phase3_bundle_inputs.png') });
  console.log('Saved focused fig_5_2_phase3_bundle_inputs.png');

  // 3. Phase 4 Assessment Schedule Table (Q15 rounds 1-4, Q30 round 5+)
  console.log('3. Setting up Phase 4 Assessment Schedule Table...');
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    const p = store.selectedPatient;
    if (!p) return;

    store.completeChecklistItem('hemoculture_1', 'พย.สุกัญญา', 'Left median cubital vein');
    store.completeChecklistItem('hemoculture_2', 'พย.สุกัญญา', 'Right cephalic vein');
    store.completeChecklistItem('iv_fluid', 'พย.สุกัญญา', 'NSS 1,000 ml IV load in 1 hr');
    store.completeChecklistItem('antibiotics_1', 'พย.สุกัญญา', 'Ceftriaxone 2g IV drip in 30 min');
    store.skipChecklistItem('antibiotics_2', 'พย.สุกัญญา');
    store.skipChecklistItem('foley_cath', 'พย.สุกัญญา');

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
      const p4 = currentData.checklist.find(c => c.phase === 'assessment_schedule');
      if (p4) p4.isUnlocked = true;
    }
    store.assessmentSchedule = currentData.assessmentSchedule;
  });
  await page.waitForTimeout(800);
  await wfCol.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_6_1_assessment_table_q15_q30.png') });
  console.log('Saved focused fig_6_1_assessment_table_q15_q30.png');

  // 4. Treatment Completed State (Green Banner)
  console.log('4. Setting up Treatment Complete...');
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    store.completeTreatment('พย.สุกัญญา');
  });
  await page.waitForTimeout(800);
  await wfCol.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_7_2_treatment_completed_state.png') });
  console.log('Saved focused fig_7_2_treatment_completed_state.png');

  // 5. Clinical Timeline with HIS Copy button
  console.log('5. Setting up Clinical Timeline...');
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    store.setActiveTab('timeline');
  });
  await page.waitForTimeout(800);
  await wfCol.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_8_1_clinical_timeline_detail.png') });
  console.log('Saved focused fig_8_1_clinical_timeline_detail.png');

  await browser.close();
  console.log('Done capturing all focused workflow panels!');
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
