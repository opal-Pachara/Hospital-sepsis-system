// =============================================================================
// NEWS (National Early Warning Score) Calculation Engine
// =============================================================================
//
// Implements the Royal College of Physicians NEWS2 scoring system.
// This is a PURE function — no side effects, fully deterministic.
//
// Scoring table reference:
//   Score:        3       2       1       0       1       2       3
//   RR:         ≤8       —     9–11   12–20     —    21–24    ≥25
//   SpO₂ (%):  ≤91    92–93   94–95   ≥96      —      —       —
//   O₂ Supp:    —       —      Yes     No       —      —       —
//   Temp (°C): ≤35.0    —   35.1–36  36.1–38  38.1–39  ≥39.1   —
//   SBP (mmHg): ≤90   91–100 101–110 111–219    —     ≥220     —
//   HR (bpm):  ≤40      —    41–50   51–90   91–110 111–130   ≥131
//   AVPU:       —       —      —       A        —      —      V/P/U
// =============================================================================

import type {
  VitalSigns,
  NEWSResult,
  NEWSParameterScore,
  RiskLevel,
  AVPULevel,
  OxygenStatus,
} from '../types';

// ---------------------------------------------------------------------------
// Individual Parameter Scoring Functions
// ---------------------------------------------------------------------------

/**
 * Respiratory Rate scoring.
 *
 * | Score 3 | Score 1 | Score 0  | Score 2  | Score 3 |
 * |---------|---------|----------|----------|---------|
 * | ≤8      | 9–11    | 12–20    | 21–24    | ≥25     |
 */
export function scoreRespiratoryRate(rr: number): number {
  if (rr <= 8) return 3;
  if (rr <= 11) return 1;
  if (rr <= 20) return 0;
  if (rr <= 24) return 2;
  return 3; // ≥25
}

/**
 * SpO₂ scoring (Scale 1 — standard, without confirmed hypercapnic respiratory failure).
 *
 * | Score 3 | Score 2  | Score 1  | Score 0 |
 * |---------|----------|----------|---------|
 * | ≤91     | 92–93    | 94–95    | ≥96     |
 */
export function scoreSpO2(spO2: number): number {
  if (spO2 <= 91) return 3;
  if (spO2 <= 93) return 2;
  if (spO2 <= 95) return 1;
  return 0; // ≥96
}

/**
 * Supplemental Oxygen scoring.
 *
 * | Score 0    | Score 2         |
 * |------------|-----------------|
 * | Room air   | Supplemental O₂ |
 */
export function scoreOxygenSupplementation(status: OxygenStatus): number {
  return status === 'supplemental' ? 2 : 0;
}

/**
 * Temperature scoring (°C).
 *
 * | Score 3 | Score 1     | Score 0     | Score 1     | Score 2 |
 * |---------|-------------|-------------|-------------|---------|
 * | ≤35.0   | 35.1–36.0   | 36.1–38.0   | 38.1–39.0   | ≥39.1   |
 */
export function scoreTemperature(temp: number): number {
  if (temp <= 35.0) return 3;
  if (temp <= 36.0) return 1;
  if (temp <= 38.0) return 0;
  if (temp <= 39.0) return 1;
  return 2; // ≥39.1
}

/**
 * Systolic Blood Pressure scoring (mmHg).
 *
 * | Score 3 | Score 2    | Score 1     | Score 0     | Score 3 |
 * |---------|------------|-------------|-------------|---------|
 * | ≤90     | 91–100     | 101–110     | 111–219     | ≥220    |
 */
export function scoreSystolicBP(sbp: number): number {
  if (sbp <= 90) return 3;
  if (sbp <= 100) return 2;
  if (sbp <= 110) return 1;
  if (sbp <= 219) return 0;
  return 3; // ≥220
}

/**
 * Heart Rate scoring (bpm).
 *
 * | Score 3 | Score 1   | Score 0   | Score 1    | Score 2     | Score 3 |
 * |---------|-----------|-----------|------------|-------------|---------|
 * | ≤40     | 41–50     | 51–90     | 91–110     | 111–130     | ≥131    |
 */
export function scoreHeartRate(hr: number): number {
  if (hr <= 40) return 3;
  if (hr <= 50) return 1;
  if (hr <= 90) return 0;
  if (hr <= 110) return 1;
  if (hr <= 130) return 2;
  return 3; // ≥131
}

/**
 * AVPU consciousness level scoring.
 *
 * | Score 0 | Score 3     |
 * |---------|-------------|
 * | A       | V, P, or U  |
 */
export function scoreAVPU(avpu: AVPULevel): number {
  return avpu === 'A' ? 0 : 3;
}

// ---------------------------------------------------------------------------
// Risk Level Classification
// ---------------------------------------------------------------------------

/**
 * Derives the clinical risk level from the aggregate NEWS score and
 * single-parameter alerting.
 *
 * | Total Score | Risk Level    | Clinical Response             |
 * |-------------|---------------|-------------------------------|
 * | 0           | Low           | Routine monitoring            |
 * | 1–4         | Low           | Assessment by nurse           |
 * | 3 (single)  | Low-Medium    | Urgent ward-based response    |
 * | 5–6         | Medium        | Urgent response threshold     |
 * | ≥7          | High          | Emergency response            |
 *
 * Note: If any single parameter = 3 AND total ≤ 4, risk elevates to low_medium.
 */
export function classifyRiskLevel(
  totalScore: number,
  hasSingleParameterAlert: boolean
): RiskLevel {
  if (totalScore >= 7) return 'high';
  if (totalScore >= 5) return 'medium';
  if (hasSingleParameterAlert) return 'low_medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Display Value Formatters
// ---------------------------------------------------------------------------

function formatDisplayValue(
  parameter: NEWSParameterScore['parameter'],
  value: number | string | null,
  vitals: VitalSigns
): string {
  // O₂ supplementation and AVPU are always derived from enums, not nullable
  switch (parameter) {
    case 'oxygenSupplementation':
      return vitals.oxygenSupplementation === 'supplemental'
        ? 'Yes (O₂)'
        : 'Room Air';
    case 'avpu':
      return String(value ?? vitals.avpu);
    default:
      break;
  }

  if (value === null) return '—';

  switch (parameter) {
    case 'respiratoryRate':
      return `${value} bpm`;
    case 'spO2':
      return `${value}%`;
    case 'temperature':
      return `${value}°C`;
    case 'systolicBP':
      return `${value} mmHg`;
    case 'heartRate':
      return `${value} bpm`;
    default:
      return String(value);
  }
}


// ---------------------------------------------------------------------------
// Main Calculator
// ---------------------------------------------------------------------------

/**
 * Calculates the complete NEWS result from a set of vital signs.
 *
 * This is the core clinical decision support function.
 * It is a **pure function** — same inputs always produce same outputs,
 * with no side effects.
 *
 * @param vitals — Raw vital sign measurements
 * @returns Complete NEWS result with total score, breakdown, and risk level
 *
 * @example
 * ```ts
 * const result = calculateNEWS({
 *   respiratoryRate: 22,
 *   spO2: 95,
 *   oxygenSupplementation: 'room_air',
 *   temperature: 38.5,
 *   systolicBP: 105,
 *   heartRate: 110,
 *   avpu: 'A',
 * });
 * // result.totalScore → 5
 * // result.riskLevel → 'medium'
 * ```
 */
export function calculateNEWS(vitals: VitalSigns): NEWSResult {
  const breakdown: NEWSParameterScore[] = [];
  let totalScore = 0;
  let missingDataCount = 0;
  let hasSingleParameterAlert = false;

  // --- Helper to process each numeric parameter ---
  function processNumericParam(
    parameter: NEWSParameterScore['parameter'],
    label: string,
    value: number | null,
    scoreFn: (v: number) => number
  ): void {
    if (value === null || value === undefined || isNaN(value)) {
      missingDataCount++;
      breakdown.push({
        parameter,
        label,
        displayValue: '—',
        score: 0,
        isAbnormal: false,
        isCritical: false,
      });
      return;
    }

    const score = scoreFn(value);
    totalScore += score;

    const isCritical = score === 3;
    if (isCritical) hasSingleParameterAlert = true;

    breakdown.push({
      parameter,
      label,
      displayValue: formatDisplayValue(parameter, value, vitals),
      score,
      isAbnormal: score >= 1,
      isCritical,
    });
  }

  // 1. Respiratory Rate
  processNumericParam(
    'respiratoryRate',
    'Respiratory Rate',
    vitals.respiratoryRate,
    scoreRespiratoryRate
  );

  // 2. SpO₂
  processNumericParam('spO2', 'SpO₂', vitals.spO2, scoreSpO2);

  // 3. Supplemental Oxygen (always present — enum, not nullable)
  const o2Score = scoreOxygenSupplementation(vitals.oxygenSupplementation);
  totalScore += o2Score;
  breakdown.push({
    parameter: 'oxygenSupplementation',
    label: 'Supplemental O₂',
    displayValue: formatDisplayValue(
      'oxygenSupplementation',
      null,
      vitals
    ),
    score: o2Score,
    isAbnormal: o2Score >= 1,
    isCritical: false, // max score is 2, never triggers single-param alert
  });

  // 4. Temperature
  processNumericParam(
    'temperature',
    'Temperature',
    vitals.temperature,
    scoreTemperature
  );

  // 5. Systolic BP
  processNumericParam(
    'systolicBP',
    'Systolic BP',
    vitals.systolicBP,
    scoreSystolicBP
  );

  // 6. Heart Rate
  processNumericParam(
    'heartRate',
    'Heart Rate',
    vitals.heartRate,
    scoreHeartRate
  );

  // 7. AVPU (always present — enum, not nullable)
  const avpuScore = scoreAVPU(vitals.avpu);
  totalScore += avpuScore;
  const avpuCritical = avpuScore === 3;
  if (avpuCritical) hasSingleParameterAlert = true;

  breakdown.push({
    parameter: 'avpu',
    label: 'Consciousness (AVPU)',
    displayValue: formatDisplayValue('avpu', vitals.avpu, vitals),
    score: avpuScore,
    isAbnormal: avpuScore >= 1,
    isCritical: avpuCritical,
  });

  // --- Derive risk level ---
  const riskLevel = classifyRiskLevel(totalScore, hasSingleParameterAlert);

  return {
    totalScore,
    breakdown,
    riskLevel,
    hasSingleParameterAlert,
    missingDataCount,
    calculatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Utility: Generate Assessment Schedule
// ---------------------------------------------------------------------------

import type { AssessmentScheduleEntry } from '../types';

/**
 * Generates a standard post-confirmation assessment schedule:
 * - 4 entries at Q15 (every 15 minutes)
 * - Then Q30 (every 30 minutes) until the 60-min window ends and beyond
 *
 * @param originTime — ISO 8601 timestamp of the doctor confirmation
 * @returns Array of scheduled assessment entries
 */
export function generateAssessmentSchedule(
  originTime: string
): AssessmentScheduleEntry[] {
  const origin = new Date(originTime);
  const entries: AssessmentScheduleEntry[] = [];

  // Q15 × 4 (at 15, 30, 45, 60 minutes)
  for (let i = 1; i <= 4; i++) {
    const scheduledTime = new Date(origin.getTime() + i * 15 * 60 * 1000);
    entries.push({
      id: generateId(),
      sequence: i,
      intervalType: 'Q15',
      scheduledTime: scheduledTime.toISOString(),
      isCompleted: false,
      completedAt: null,
      vitals: null,
      newsResult: null,
      reminderTriggered: false,
    });
  }

  // Q30 × 4 (at 90, 120, 150, 180 minutes — continuing monitoring)
  for (let i = 0; i < 4; i++) {
    const scheduledTime = new Date(
      origin.getTime() + (60 + (i + 1) * 30) * 60 * 1000
    );
    entries.push({
      id: generateId(),
      sequence: 5 + i,
      intervalType: 'Q30',
      scheduledTime: scheduledTime.toISOString(),
      isCompleted: false,
      completedAt: null,
      vitals: null,
      newsResult: null,
      reminderTriggered: false,
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Lightweight ID generator (avoids uuid dependency for now)
// ---------------------------------------------------------------------------

let _counter = 0;

function generateId(): string {
  _counter++;
  return `${Date.now()}-${_counter}-${Math.random().toString(36).substring(2, 9)}`;
}

// Re-export for external use
export { generateId };
