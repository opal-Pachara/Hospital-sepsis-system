const { chromium } = require('playwright');
const path = require('path');

const MANUAL_IMG_DIR = path.resolve(__dirname, '../docs/images/manual');
const ARTIFACT_DIR = '/Users/phatchara/.gemini/antigravity-ide/brain/012286c4-4fd3-4bd9-b9cb-b5a7de082131';

async function captureModals() {
  console.log('Launching browser...');
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

  // Set up mock patients in store
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
      allergies: [],
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
      attendingPhysician: null,
      primaryNurse: 'พย.สุกัญญา',
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
      primaryNurse: 'พย.นิดา',
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

  // 1. Capture AlertModal (🚨 🔴 แจ้งเตือน — เสี่ยงติดเชื้อในกระแสเลือด)
  console.log('Triggering single Sepsis AlertModal...');
  await page.evaluate(() => {
    window.__rtsas_store.getState().openModal('alert', {
      hn: 'HN****0183',
      newsScore: 16,
      patientName: 'HN****0183',
    });
  });

  await page.waitForTimeout(1000);

  const alertModalPath1 = path.join(MANUAL_IMG_DIR, '03_sepsis_alert_modal.png');
  const alertModalPathArtifact = path.join(ARTIFACT_DIR, '03_sepsis_alert_modal_fixed.png');
  await page.screenshot({ path: alertModalPath1 });
  await page.screenshot({ path: alertModalPathArtifact });
  console.log(`Saved single alert modal screenshot to ${alertModalPath1}`);

  // 2. Trigger MultiAlertModal (🚨 คิวผู้ป่วยเสี่ยง Sepsis ระดับสูง)
  console.log('Triggering MultiAlertModal...');
  await page.evaluate(() => {
    window.__rtsas_store.setState({
      pendingAlerts: [
        { hn: 'HN****0183', newsScore: 16, timestamp: Date.now() },
        { hn: 'HN****0186', newsScore: 14, timestamp: Date.now() }
      ]
    });
    window.__rtsas_store.getState().openModal('multi_alert');
  });

  await page.waitForTimeout(1000);

  const multiAlertModalPath1 = path.join(MANUAL_IMG_DIR, '04_multi_alert_queue.png');
  const multiAlertModalPathArtifact = path.join(ARTIFACT_DIR, '04_multi_alert_queue_fixed.png');
  await page.screenshot({ path: multiAlertModalPath1 });
  await page.screenshot({ path: multiAlertModalPathArtifact });
  console.log(`Saved multi alert modal screenshot to ${multiAlertModalPath1}`);

  await browser.close();
  console.log('Done capturing all real emergency modals!');
}

captureModals().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
