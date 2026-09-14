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

  // 1. Ensure patient HN100187 is selected
  console.log('Selecting patient HN100187...');
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    const p = store.patients.find(pt => pt.hn.includes('0187')) || store.patients[0];
    if (p) {
      window.__rtsas_store.getState().selectPatient(p.id);
    }
  });
  await page.waitForTimeout(1000);

  // 2. Capture 01_main_dashboard.png
  console.log('Capturing 01_main_dashboard.png ...');
  const mainDashPath = path.join(MANUAL_IMG_DIR, '01_main_dashboard.png');
  await page.screenshot({ path: mainDashPath });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_main_dashboard_overview_1789109548925.png') });

  // 3. Capture 02_patient_detail_vitals.png
  console.log('Capturing 02_patient_detail_vitals.png ...');
  const vitalsPath = path.join(MANUAL_IMG_DIR, '02_patient_detail_vitals.png');
  await page.screenshot({ path: vitalsPath });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'dashboard_hn0186_chief_complaint_1789109322338.png') });

  // 4. Capture fig_3_1_sidebar.png (Sidebar element)
  console.log('Capturing fig_3_1_sidebar.png ...');
  const sidebarEl = page.locator('aside, .sidebar, [class*="sidebar"]').first();
  const sidebarPath = path.join(MANUAL_IMG_DIR, 'fig_3_1_sidebar.png');
  if (await sidebarEl.count() > 0) {
    await sidebarEl.screenshot({ path: sidebarPath });
  } else {
    // fallback crop via clip
    await page.screenshot({
      path: sidebarPath,
      clip: { x: 0, y: 56, width: 280, height: 840 }
    });
  }

  // 5. Capture fig_4_2_chief_complaint.png
  console.log('Capturing fig_4_2_chief_complaint.png ...');
  const complaintPath = path.join(MANUAL_IMG_DIR, 'fig_4_2_chief_complaint.png');
  const complaintEl = page.locator('#chief-complaint-box');
  if (await complaintEl.count() > 0) {
    await complaintEl.screenshot({ path: complaintPath });
  } else {
    await page.screenshot({
      path: complaintPath,
      clip: { x: 1180, y: 110, width: 440, height: 120 }
    });
  }

  // 6. Trigger and capture 03_sepsis_alert_modal.png (Emergency alert modal for HN100187)
  console.log('Triggering AlertModal for HN100187 ...');
  await page.evaluate(() => {
    const store = window.__rtsas_store.getState();
    const p = store.patients.find(pt => pt.hn.includes('0187')) || store.patients[0];
    window.__rtsas_store.getState().openModal('alert', {
      hn: p.hn,
      newsScore: p.latestNewsScore || 16,
      patientName: p.fullName || p.hn,
    });
  });
  await page.waitForTimeout(1000);

  const alertModalPath = path.join(MANUAL_IMG_DIR, '03_sepsis_alert_modal.png');
  await page.screenshot({ path: alertModalPath });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '08_single_alert_modal_1789110617107.png') });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_sepsis_alert_modal_fixed.png') });
  console.log('Saved 03_sepsis_alert_modal.png');

  // 7. Trigger and capture 04_multi_alert_queue.png with HN100187
  console.log('Triggering MultiAlertModal with HN100187 ...');
  await page.evaluate(() => {
    window.__rtsas_store.setState({
      pendingAlerts: [
        { hn: 'HN100187', newsScore: 16, timestamp: Date.now() },
        { hn: 'HN-660042', newsScore: 8, timestamp: Date.now() }
      ]
    });
    window.__rtsas_store.getState().openModal('multi_alert');
  });
  await page.waitForTimeout(1000);

  const multiAlertPath = path.join(MANUAL_IMG_DIR, '04_multi_alert_queue.png');
  await page.screenshot({ path: multiAlertPath });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '09_multi_alert_modal_1789111248380.png') });
  console.log('Saved 04_multi_alert_queue.png');

  await browser.close();
  console.log('All figures updated with new patient HN100187 successfully!');
}

run().catch((err) => {
  console.error('Error running capture:', err);
  process.exit(1);
});
