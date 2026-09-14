import type {
  Patient,
  VitalSigns,
  NEWSResult,
  NEWSParameterScore,
  TreatmentStatus,
} from '../types';
import { gcsToAVPU } from '../types';
import { maskHN } from './hnMask';

export interface BackendNEWSParameter {
  parameter: string;
  label: string;
  displayValue: string;
  score: number;
  isAbnormal: boolean;
  isCritical: boolean;
}

export interface BackendNEWSResult {
  totalScore: number;
  breakdown: BackendNEWSParameter[];
  riskLevel: 'low' | 'low_medium' | 'medium' | 'high';
  hasSingleParameterAlert: boolean;
  missingDataCount: number;
  calculatedAt: string;
}

export interface BackendPatient {
  id: string;
  hn: string;
  vn: string | null;
  patient_name: string | null;
  age: number | null;
  vstdate: string;
  vsttime: string;
  sex: 'male' | 'female' | 'other' | null;
  chief_complaint: string | null;
  weight: number | null;
  height: number | null;
  gcs: number | null;
  spo2: number | null;
  heart_rate: number | null;
  sbp: number | null;
  dbp: number | null;
  resp_rate: number | null;
  temperature: number | null;
  news_result: BackendNEWSResult;
  arrival_time: string;
  treatment_status?: TreatmentStatus | null;
}

export function riskToTriageLevel(risk: string): Patient['triageLevel'] {
  if (risk === 'high') return 'resuscitation';
  if (risk === 'medium') return 'emergency';
  if (risk === 'low_medium') return 'urgent';
  return 'semi_urgent';
}

export function mapBackendToPatient(bp: BackendPatient): Patient {
  const gcs = bp.gcs ?? 15;

  const vitals: VitalSigns = {
    respiratoryRate: bp.resp_rate ?? null,
    spO2: bp.spo2 ?? null,
    oxygenSupplementation: 'room_air',
    temperature: bp.temperature ?? null,
    systolicBP: bp.sbp ?? null,
    heartRate: bp.heart_rate ?? null,
    gcs,
    avpu: gcsToAVPU(gcs),
  };

  const newsResult: NEWSResult = {
    totalScore: bp.news_result.totalScore,
    breakdown: bp.news_result.breakdown.map((b): NEWSParameterScore => ({
      parameter: b.parameter as NEWSParameterScore['parameter'],
      label: b.label,
      displayValue: b.displayValue,
      score: b.score,
      isAbnormal: b.isAbnormal,
      isCritical: b.isCritical,
    })),
    riskLevel: bp.news_result.riskLevel,
    hasSingleParameterAlert: bp.news_result.hasSingleParameterAlert,
    missingDataCount: bp.news_result.missingDataCount,
    calculatedAt: bp.news_result.calculatedAt,
  };

  let arrivalTime = bp.arrival_time;
  if ((!arrivalTime || arrivalTime.endsWith('T00:00:00') || arrivalTime.endsWith('T00:00')) && bp.vsttime) {
    const timeParts = bp.vsttime.split(':');
    if (timeParts.length >= 2) {
      const hh = timeParts[0].padStart(2, '0');
      const mm = timeParts[1].padStart(2, '0');
      const ss = (timeParts[2] || '00').padStart(2, '0');
      const datePart = bp.vstdate || new Date().toISOString().split('T')[0];
      arrivalTime = `${datePart}T${hh}:${mm}:${ss}`;
    }
  }

  return {
    id: bp.hn,
    hn: bp.hn,
    vn: bp.vn ?? '',
    fullName: maskHN(bp.hn),
    age: (bp.age != null && bp.age > 0) ? bp.age : null,
    gender: bp.sex ?? 'other',
    triageLevel: riskToTriageLevel(bp.news_result.riskLevel),
    arrivalTime: arrivalTime || new Date().toISOString(),
    chiefComplaint: bp.chief_complaint ?? 'ไม่ระบุ',
    allergies: [],
    currentRiskLevel: bp.news_result.riskLevel,
    latestNewsScore: bp.news_result.totalScore,
    latestVitals: vitals,
    latestNewsResult: newsResult,
    hasSepsisAlert: bp.news_result.totalScore >= 5 && bp.news_result.riskLevel === 'high',
    attendingPhysician: null,
    primaryNurse: null,
    location: `VN: ${bp.vn ?? '-'}`,
    treatmentStatus: bp.treatment_status ?? null,
  };
}
