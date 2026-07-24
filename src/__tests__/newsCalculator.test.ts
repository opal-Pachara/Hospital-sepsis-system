// =============================================================================
// NEWS Calculator — Unit Tests
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateNEWS,
  scoreRespiratoryRate,
  scoreSpO2,
  scoreOxygenSupplementation,
  scoreTemperature,
  scoreSystolicBP,
  scoreHeartRate,
  scoreAVPU,
  classifyRiskLevel,
  generateAssessmentSchedule,
} from '../utils/newsCalculator';
import type { VitalSigns } from '../types';

// ---------------------------------------------------------------------------
// Individual Scoring Functions
// ---------------------------------------------------------------------------

describe('scoreRespiratoryRate', () => {
  it('returns 3 for RR ≤ 8', () => {
    expect(scoreRespiratoryRate(8)).toBe(3);
    expect(scoreRespiratoryRate(5)).toBe(3);
    expect(scoreRespiratoryRate(0)).toBe(3);
  });

  it('returns 1 for RR 9–11', () => {
    expect(scoreRespiratoryRate(9)).toBe(1);
    expect(scoreRespiratoryRate(10)).toBe(1);
    expect(scoreRespiratoryRate(11)).toBe(1);
  });

  it('returns 0 for RR 12–20', () => {
    expect(scoreRespiratoryRate(12)).toBe(0);
    expect(scoreRespiratoryRate(16)).toBe(0);
    expect(scoreRespiratoryRate(20)).toBe(0);
  });

  it('returns 2 for RR 21–24', () => {
    expect(scoreRespiratoryRate(21)).toBe(2);
    expect(scoreRespiratoryRate(24)).toBe(2);
  });

  it('returns 3 for RR ≥ 25', () => {
    expect(scoreRespiratoryRate(25)).toBe(3);
    expect(scoreRespiratoryRate(40)).toBe(3);
  });
});

describe('scoreSpO2', () => {
  it('returns 3 for SpO₂ ≤ 91', () => {
    expect(scoreSpO2(91)).toBe(3);
    expect(scoreSpO2(80)).toBe(3);
  });

  it('returns 2 for SpO₂ 92–93', () => {
    expect(scoreSpO2(92)).toBe(2);
    expect(scoreSpO2(93)).toBe(2);
  });

  it('returns 1 for SpO₂ 94–95', () => {
    expect(scoreSpO2(94)).toBe(1);
    expect(scoreSpO2(95)).toBe(1);
  });

  it('returns 0 for SpO₂ ≥ 96', () => {
    expect(scoreSpO2(96)).toBe(0);
    expect(scoreSpO2(100)).toBe(0);
  });
});

describe('scoreOxygenSupplementation', () => {
  it('returns 0 for room air', () => {
    expect(scoreOxygenSupplementation('room_air')).toBe(0);
  });

  it('returns 2 for supplemental oxygen', () => {
    expect(scoreOxygenSupplementation('supplemental')).toBe(2);
  });
});

describe('scoreTemperature', () => {
  it('returns 3 for temp ≤ 35.0', () => {
    expect(scoreTemperature(35.0)).toBe(3);
    expect(scoreTemperature(34.0)).toBe(3);
  });

  it('returns 1 for temp 35.1–36.0', () => {
    expect(scoreTemperature(35.1)).toBe(1);
    expect(scoreTemperature(36.0)).toBe(1);
  });

  it('returns 0 for temp 36.1–38.0', () => {
    expect(scoreTemperature(36.1)).toBe(0);
    expect(scoreTemperature(37.0)).toBe(0);
    expect(scoreTemperature(38.0)).toBe(0);
  });

  it('returns 1 for temp 38.1–39.0', () => {
    expect(scoreTemperature(38.1)).toBe(1);
    expect(scoreTemperature(39.0)).toBe(1);
  });

  it('returns 2 for temp ≥ 39.1', () => {
    expect(scoreTemperature(39.1)).toBe(2);
    expect(scoreTemperature(41.0)).toBe(2);
  });
});

describe('scoreSystolicBP', () => {
  it('returns 3 for SBP ≤ 90', () => {
    expect(scoreSystolicBP(90)).toBe(3);
    expect(scoreSystolicBP(60)).toBe(3);
  });

  it('returns 2 for SBP 91–100', () => {
    expect(scoreSystolicBP(91)).toBe(2);
    expect(scoreSystolicBP(100)).toBe(2);
  });

  it('returns 1 for SBP 101–110', () => {
    expect(scoreSystolicBP(101)).toBe(1);
    expect(scoreSystolicBP(110)).toBe(1);
  });

  it('returns 0 for SBP 111–219', () => {
    expect(scoreSystolicBP(111)).toBe(0);
    expect(scoreSystolicBP(120)).toBe(0);
    expect(scoreSystolicBP(219)).toBe(0);
  });

  it('returns 3 for SBP ≥ 220', () => {
    expect(scoreSystolicBP(220)).toBe(3);
    expect(scoreSystolicBP(250)).toBe(3);
  });
});

describe('scoreHeartRate', () => {
  it('returns 3 for HR ≤ 40', () => {
    expect(scoreHeartRate(40)).toBe(3);
    expect(scoreHeartRate(30)).toBe(3);
  });

  it('returns 1 for HR 41–50', () => {
    expect(scoreHeartRate(41)).toBe(1);
    expect(scoreHeartRate(50)).toBe(1);
  });

  it('returns 0 for HR 51–90', () => {
    expect(scoreHeartRate(51)).toBe(0);
    expect(scoreHeartRate(72)).toBe(0);
    expect(scoreHeartRate(90)).toBe(0);
  });

  it('returns 1 for HR 91–110', () => {
    expect(scoreHeartRate(91)).toBe(1);
    expect(scoreHeartRate(110)).toBe(1);
  });

  it('returns 2 for HR 111–130', () => {
    expect(scoreHeartRate(111)).toBe(2);
    expect(scoreHeartRate(130)).toBe(2);
  });

  it('returns 3 for HR ≥ 131', () => {
    expect(scoreHeartRate(131)).toBe(3);
    expect(scoreHeartRate(180)).toBe(3);
  });
});

describe('scoreAVPU', () => {
  it('returns 0 for A (Alert)', () => {
    expect(scoreAVPU('A')).toBe(0);
  });

  it('returns 3 for V, P, or U', () => {
    expect(scoreAVPU('V')).toBe(3);
    expect(scoreAVPU('P')).toBe(3);
    expect(scoreAVPU('U')).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Risk Level Classification
// ---------------------------------------------------------------------------

describe('classifyRiskLevel', () => {
  it('returns "low" for score 0', () => {
    expect(classifyRiskLevel(0, false)).toBe('low');
  });

  it('returns "low" for score 1–4 without single-param alert', () => {
    expect(classifyRiskLevel(1, false)).toBe('low');
    expect(classifyRiskLevel(4, false)).toBe('low');
  });

  it('returns "low_medium" for score ≤ 4 WITH single-param alert', () => {
    expect(classifyRiskLevel(3, true)).toBe('low_medium');
    expect(classifyRiskLevel(4, true)).toBe('low_medium');
  });

  it('returns "medium" for score 5–6', () => {
    expect(classifyRiskLevel(5, false)).toBe('medium');
    expect(classifyRiskLevel(6, false)).toBe('medium');
    expect(classifyRiskLevel(5, true)).toBe('medium');
  });

  it('returns "high" for score ≥ 7', () => {
    expect(classifyRiskLevel(7, false)).toBe('high');
    expect(classifyRiskLevel(12, true)).toBe('high');
    expect(classifyRiskLevel(20, false)).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// Full calculateNEWS Integration
// ---------------------------------------------------------------------------

describe('calculateNEWS', () => {
  it('returns score 0 for perfectly normal vitals', () => {
    const vitals: VitalSigns = {
      respiratoryRate: 16,
      spO2: 98,
      oxygenSupplementation: 'room_air',
      temperature: 37.0,
      systolicBP: 120,
      heartRate: 72,
      gcs: 15,
      avpu: 'A',
    };

    const result = calculateNEWS(vitals);

    expect(result.totalScore).toBe(0);
    expect(result.riskLevel).toBe('low');
    expect(result.hasSingleParameterAlert).toBe(false);
    expect(result.missingDataCount).toBe(0);
    expect(result.breakdown).toHaveLength(7);
    expect(result.breakdown.every((b) => b.score === 0)).toBe(true);
  });

  it('correctly scores a high-risk sepsis scenario', () => {
    const vitals: VitalSigns = {
      respiratoryRate: 28, // Score 3
      spO2: 91,            // Score 3
      oxygenSupplementation: 'supplemental', // Score 2
      temperature: 39.5,   // Score 2
      systolicBP: 85,      // Score 3
      heartRate: 135,      // Score 3
      gcs: 12,
      avpu: 'V',           // Score 3
    };

    const result = calculateNEWS(vitals);

    expect(result.totalScore).toBe(19);
    expect(result.riskLevel).toBe('high');
    expect(result.hasSingleParameterAlert).toBe(true);
  });

  it('handles the single-parameter alert correctly', () => {
    // Only AVPU is abnormal (V = score 3), rest normal → total = 3
    const vitals: VitalSigns = {
      respiratoryRate: 16,
      spO2: 98,
      oxygenSupplementation: 'room_air',
      temperature: 37.0,
      systolicBP: 120,
      heartRate: 72,
      gcs: 12,
      avpu: 'V', // Score 3
    };

    const result = calculateNEWS(vitals);

    expect(result.totalScore).toBe(3);
    expect(result.hasSingleParameterAlert).toBe(true);
    expect(result.riskLevel).toBe('low_medium');
  });

  it('handles missing (null) data gracefully', () => {
    const vitals: VitalSigns = {
      respiratoryRate: null,
      spO2: null,
      oxygenSupplementation: 'room_air',
      temperature: null,
      systolicBP: null,
      heartRate: null,
      gcs: 15,
      avpu: 'A',
    };

    const result = calculateNEWS(vitals);

    // Only O₂ supplementation (0) and AVPU (0) contribute
    expect(result.totalScore).toBe(0);
    expect(result.missingDataCount).toBe(5);
    // 5 numeric params are null (displayed as '—'), O₂ supp and AVPU always have values
    const missingEntries = result.breakdown.filter((b) => b.displayValue === '—');
    expect(missingEntries).toHaveLength(5);
  });

  it('produces correct breakdown labels and display values', () => {
    const vitals: VitalSigns = {
      respiratoryRate: 22,
      spO2: 95,
      oxygenSupplementation: 'room_air',
      temperature: 38.5,
      systolicBP: 105,
      heartRate: 110,
      gcs: 15,
      avpu: 'A',
    };

    const result = calculateNEWS(vitals);

    const rrBreakdown = result.breakdown.find(
      (b) => b.parameter === 'respiratoryRate'
    );
    expect(rrBreakdown?.score).toBe(2);
    expect(rrBreakdown?.displayValue).toBe('22 bpm');
    expect(rrBreakdown?.isAbnormal).toBe(true);
    expect(rrBreakdown?.isCritical).toBe(false);

    const tempBreakdown = result.breakdown.find(
      (b) => b.parameter === 'temperature'
    );
    expect(tempBreakdown?.score).toBe(1);
    expect(tempBreakdown?.displayValue).toBe('38.5°C');

    // Total: RR(2) + SpO2(1) + O2(0) + Temp(1) + SBP(1) + HR(1) + AVPU(0) = 6
    expect(result.totalScore).toBe(6);
    expect(result.riskLevel).toBe('medium');
  });

  it('calculates the medium-risk threshold at exactly score 5', () => {
    const vitals: VitalSigns = {
      respiratoryRate: 22,  // Score 2
      spO2: 95,             // Score 1
      oxygenSupplementation: 'supplemental', // Score 2
      temperature: 37.0,    // Score 0
      systolicBP: 120,      // Score 0
      heartRate: 72,        // Score 0
      gcs: 15,
      avpu: 'A',            // Score 0
    };

    const result = calculateNEWS(vitals);
    expect(result.totalScore).toBe(5);
    expect(result.riskLevel).toBe('medium');
  });

  it('includes a valid calculatedAt timestamp', () => {
    const vitals: VitalSigns = {
      respiratoryRate: 16,
      spO2: 98,
      oxygenSupplementation: 'room_air',
      temperature: 37.0,
      systolicBP: 120,
      heartRate: 72,
      gcs: 15,
      avpu: 'A',
    };

    const result = calculateNEWS(vitals);
    expect(new Date(result.calculatedAt).getTime()).not.toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// Assessment Schedule Generation
// ---------------------------------------------------------------------------

describe('generateAssessmentSchedule', () => {
  const originTime = '2026-06-21T10:00:00.000Z';

  it('generates 8 total entries (4 × Q15 + 4 × Q30)', () => {
    const entries = generateAssessmentSchedule(originTime);
    expect(entries).toHaveLength(8);
  });

  it('first 4 entries are Q15 at correct times', () => {
    const entries = generateAssessmentSchedule(originTime);
    const q15Entries = entries.filter((e) => e.intervalType === 'Q15');
    expect(q15Entries).toHaveLength(4);

    const origin = new Date(originTime).getTime();
    expect(new Date(q15Entries[0].scheduledTime).getTime()).toBe(
      origin + 15 * 60 * 1000
    );
    expect(new Date(q15Entries[1].scheduledTime).getTime()).toBe(
      origin + 30 * 60 * 1000
    );
    expect(new Date(q15Entries[2].scheduledTime).getTime()).toBe(
      origin + 45 * 60 * 1000
    );
    expect(new Date(q15Entries[3].scheduledTime).getTime()).toBe(
      origin + 60 * 60 * 1000
    );
  });

  it('last 4 entries are Q30 at correct times', () => {
    const entries = generateAssessmentSchedule(originTime);
    const q30Entries = entries.filter((e) => e.intervalType === 'Q30');
    expect(q30Entries).toHaveLength(4);

    const origin = new Date(originTime).getTime();
    expect(new Date(q30Entries[0].scheduledTime).getTime()).toBe(
      origin + 90 * 60 * 1000
    );
    expect(new Date(q30Entries[1].scheduledTime).getTime()).toBe(
      origin + 120 * 60 * 1000
    );
    expect(new Date(q30Entries[2].scheduledTime).getTime()).toBe(
      origin + 150 * 60 * 1000
    );
    expect(new Date(q30Entries[3].scheduledTime).getTime()).toBe(
      origin + 180 * 60 * 1000
    );
  });

  it('all entries start as incomplete', () => {
    const entries = generateAssessmentSchedule(originTime);
    expect(entries.every((e) => !e.isCompleted)).toBe(true);
    expect(entries.every((e) => e.vitals === null)).toBe(true);
    expect(entries.every((e) => e.newsResult === null)).toBe(true);
  });

  it('entries have sequential numbering', () => {
    const entries = generateAssessmentSchedule(originTime);
    entries.forEach((entry, index) => {
      expect(entry.sequence).toBe(index + 1);
    });
  });

  it('all entries have unique IDs', () => {
    const entries = generateAssessmentSchedule(originTime);
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
