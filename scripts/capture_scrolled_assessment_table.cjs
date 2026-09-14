const { chromium } = require('playwright');
const path = require('path');

const MANUAL_IMG_DIR = path.resolve(__dirname, '../docs/images/manual');

async function run() {
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

  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    const p = store.patients.find(pt => pt.hn.includes('0187')) || store.patients[0];
    store.selectPatient(p.id);
    store.setActiveTab('checklist');

    store.completeChecklistItem('triage', 'พย.สุกัญญา');
    store.completeChecklistItem('er_admission', 'พย.สุกัญญา');
    store.completeChecklistItem('initial_report', 'พย.สุกัญญา');
    store.completeChecklistItem('doctor_confirm', 'นพ.เกียรติศักดิ์');

    store.completeChecklistItem('hemoculture_1', 'พย.สุกัญญา', 'Left median cubital vein');
    store.completeChecklistItem('hemoculture_2', 'พย.สุกัญญา', 'Right cephalic vein');
    store.completeChecklistItem('iv_fluid', 'พย.สุกัญญา', 'NSS 1,000 ml IV load in 1 hr');
    store.completeChecklistItem('antibiotics_1', 'พย.สุกัญญา', 'Ceftriaxone 2g IV drip in 30 min');
    store.skipChecklistItem('antibiotics_2', 'พย.สุกัญญา');
    store.skipChecklistItem('foley_cath', 'พย.สุกัญญา');

    // Generate schedule
    store.generateSchedule(new Date(Date.now() - 45 * 60000).toISOString());
  });
  await page.waitForTimeout(1000);

  // Mark first 3 entries complete
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    const sched = store.assessmentSchedule;
    if (sched && sched.entries.length >= 3) {
      sched.entries[0].isCompleted = true;
      sched.entries[0].newsResult = { totalScore: 16, riskLevel: 'high' };
      sched.entries[1].isCompleted = true;
      sched.entries[1].newsResult = { totalScore: 12, riskLevel: 'high' };
      sched.entries[2].isCompleted = true;
      sched.entries[2].newsResult = { totalScore: 8, riskLevel: 'medium' };
      window.__rtsas_store.setState({ assessmentSchedule: { ...sched } });
    }
  });
  await page.waitForTimeout(600);

  // Scroll down
  await page.evaluate(() => {
    const el = document.querySelector('.workflow-panel-col .overflow-y-auto');
    if (el) el.scrollTop = 600;
  });
  await page.waitForTimeout(600);

  const wfCol = page.locator('.workflow-panel-col').first();
  await wfCol.screenshot({ path: path.join(MANUAL_IMG_DIR, 'fig_6_1_assessment_table_q15_q30.png') });
  console.log('Saved perfect fig_6_1_assessment_table_q15_q30.png');

  await browser.close();
}

run().catch(console.error);
