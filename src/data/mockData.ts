// =============================================================================
// Mock / Seed Data for Development & Testing
// =============================================================================

import type { Patient, VitalSigns } from '../types';
import { calculateNEWS } from '../utils/newsCalculator';

// ---------------------------------------------------------------------------
// Sample Vital Signs Scenarios
// ---------------------------------------------------------------------------

/** Healthy patient — all vitals normal */
export const VITALS_NORMAL: VitalSigns = {
  respiratoryRate: 16,
  spO2: 98,
  oxygenSupplementation: 'room_air',
  temperature: 37.0,
  systolicBP: 120,
  heartRate: 72,
  avpu: 'A',
};

/** Moderate sepsis risk — NEWS ≈ 5–6 */
export const VITALS_MODERATE_RISK: VitalSigns = {
  respiratoryRate: 22,
  spO2: 95,
  oxygenSupplementation: 'room_air',
  temperature: 38.5,
  systolicBP: 105,
  heartRate: 110,
  avpu: 'A',
};

/** High sepsis risk — NEWS ≥ 7 */
export const VITALS_HIGH_RISK: VitalSigns = {
  respiratoryRate: 28,
  spO2: 91,
  oxygenSupplementation: 'supplemental',
  temperature: 39.5,
  systolicBP: 85,
  heartRate: 135,
  avpu: 'V',
};

/** Single-parameter alert — otherwise normal, but AVPU = V */
export const VITALS_SINGLE_ALERT: VitalSigns = {
  respiratoryRate: 16,
  spO2: 98,
  oxygenSupplementation: 'room_air',
  temperature: 37.0,
  systolicBP: 120,
  heartRate: 72,
  avpu: 'V',
};

// ---------------------------------------------------------------------------
// Sample Patients
// ---------------------------------------------------------------------------

function createMockPatient(
  overrides: Partial<Patient> & { id: string; fullName: string; vitals: VitalSigns }
): Patient {
  const newsResult = calculateNEWS(overrides.vitals);

  return {
    hn: overrides.hn ?? `HN-${overrides.id}`,
    vn: overrides.vn ?? `VN-${Date.now()}-${overrides.id}`,
    age: overrides.age ?? 55,
    gender: overrides.gender ?? 'male',
    triageLevel: overrides.triageLevel ?? 'urgent',
    arrivalTime: overrides.arrivalTime ?? new Date().toISOString(),
    chiefComplaint: overrides.chiefComplaint ?? 'Fever, altered consciousness',
    allergies: overrides.allergies ?? [],
    currentRiskLevel: newsResult.riskLevel,
    latestNewsScore: newsResult.totalScore,
    latestVitals: overrides.vitals,
    latestNewsResult: newsResult,
    hasSepsisAlert:
      newsResult.totalScore >= 5 || newsResult.hasSingleParameterAlert,
    attendingPhysician: overrides.attendingPhysician ?? null,
    primaryNurse: overrides.primaryNurse ?? 'พย.สุกัญญา',
    location: overrides.location ?? 'ER-01',
    ...overrides,
    // Override computed fields back after spread (ensure they are not in overrides or handle differently)
  };
}

export const MOCK_PATIENTS: Patient[] = [
  createMockPatient({
    id: 'P001',
    fullName: 'นายสมชาย ใจดี',
    hn: 'HN-660001',
    vn: 'VN-660001-01',
    age: 67,
    gender: 'male',
    triageLevel: 'emergency',
    chiefComplaint: 'ไข้สูง 3 วัน, หายใจเร็ว, ความดันต่ำ',
    allergies: ['Penicillin'],
    attendingPhysician: 'นพ.วิชัย',
    primaryNurse: 'พย.สุกัญญา',
    location: 'ER-03',
    vitals: VITALS_HIGH_RISK,
    arrivalTime: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  }),
  createMockPatient({
    id: 'P002',
    fullName: 'นางมาลี สุขสันต์',
    hn: 'HN-660042',
    vn: 'VN-660042-01',
    age: 52,
    gender: 'female',
    triageLevel: 'urgent',
    chiefComplaint: 'ปวดท้อง, ไข้ต่ำ',
    allergies: [],
    primaryNurse: 'พย.นิดา',
    location: 'ER-07',
    vitals: VITALS_MODERATE_RISK,
    arrivalTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  }),
  createMockPatient({
    id: 'P003',
    fullName: 'นายประเสริฐ มงคล',
    hn: 'HN-660108',
    vn: 'VN-660108-01',
    age: 45,
    gender: 'male',
    triageLevel: 'semi_urgent',
    chiefComplaint: 'ไอ, เจ็บคอ',
    allergies: ['Sulfa'],
    primaryNurse: 'พย.สมใจ',
    location: 'ER-12',
    vitals: VITALS_NORMAL,
    arrivalTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  }),
  createMockPatient({
    id: 'P004',
    fullName: 'นางสาวพิมพ์ลดา วงศ์สกุล',
    hn: 'HN-660203',
    vn: 'VN-660203-01',
    age: 34,
    gender: 'female',
    triageLevel: 'urgent',
    chiefComplaint: 'ไข้สูง, ซึมลง',
    allergies: [],
    attendingPhysician: 'พญ.อรุณี',
    primaryNurse: 'พย.กมล',
    location: 'ER-05',
    vitals: VITALS_SINGLE_ALERT,
    arrivalTime: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  }),
];
