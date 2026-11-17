import type { Patient } from '../../types';
import { useRTSASStore } from '../../store/useRTSASStore';
import { maskHN } from '../../utils/hnMask';
import { logClientEvent } from '../../utils/logHelpers';
import {
  PARAM_LABELS_TH,
  CRITICAL_PARAM_THRESHOLDS_TH,
  filterDisplayBreakdownItems,
  NewsBreakdownChips,
} from './AlertModal';

export interface SingleParamAlertModalContentProps {
  patient: Patient | null | undefined;
  alertHN: string;
  alertNewsScore: number;
  onAcknowledge: () => void;
  onAssessPending: () => void;
  onClose: () => void;
}

export interface SingleParamModalData {
  newsScore: number;
  patientName?: string;
  hn?: string;
  patientSnapshot?: Patient;
}

/**
 * Resolves the target patient and score for SingleParamAlertModal without ever falling back
 * to an unrelated selectedPatient whose HN/ID does not match the alert target.
 */
export function resolveSingleParamAlertTarget(
  data: SingleParamModalData | null,
  patients: Patient[],
  selectedPatient: Patient | null
) {
  const alertHN = data?.hn || data?.patientName || '';
  const alertedPatient = data
    ? patients.find(
        (p) =>
          (data.hn ? p.hn === data.hn || p.id === data.hn : false) ||
          (!data.hn && data.patientName
            ? p.hn === data.patientName || p.id === data.patientName || p.fullName === data.patientName
            : false)
      )
    : undefined;

  const matchedSelected =
    selectedPatient &&
    (!alertHN || selectedPatient.hn === alertHN || selectedPatient.id === alertHN)
      ? selectedPatient
      : undefined;

  const useLiveAlerted = Boolean(
    alertedPatient &&
      (!data?.patientSnapshot ||
        alertedPatient.latestNewsResult?.totalScore === data.newsScore ||
        alertedPatient.latestNewsResult?.breakdown?.some((b) => b.score === 3))
  );

  const patient = useLiveAlerted
    ? alertedPatient
    : (data?.patientSnapshot ?? alertedPatient ?? matchedSelected);

  const alertNewsScore =
    patient?.latestNewsResult?.totalScore ?? data?.newsScore ?? patient?.latestNewsScore ?? 0;

  const targetHn = patient?.hn ?? alertedPatient?.hn ?? alertHN;
  const targetPatientId = patient?.id ?? alertedPatient?.id ?? targetHn;

  return { patient, alertNewsScore, targetHn, targetPatientId };
}

export default function SingleParamAlertModal() {
  const { ui, closeModal, patients, selectedPatient, selectPatient, openModal } = useRTSASStore();

  if (ui.modal.activeModal !== 'single_param_alert') return null;

  const data = ui.modal.modalData as SingleParamModalData | null;

  if (!data) return null;

  const { patient, alertNewsScore, targetHn, targetPatientId } = resolveSingleParamAlertTarget(
    data,
    patients,
    selectedPatient
  );

  const breakdownItems = filterDisplayBreakdownItems(patient?.latestNewsResult?.breakdown);
  const criticalParams = breakdownItems.filter((p) => p.score === 3);

  const dismissSingleAlert = () => {
    if (targetHn) {
      useRTSASStore.getState().markAlertDismissed(targetHn, `single3_${targetHn}`);
    }
  };

  const handleClose = () => {
    dismissSingleAlert();
    closeModal();
  };

  const handleAssessPending = () => {
    dismissSingleAlert();
    const curUser = useRTSASStore.getState().currentUser;
    const actorName = curUser?.name || 'พยาบาลวิชาชีพ';
    if (targetHn) {
      const cleanHn = targetHn.toUpperCase().startsWith('HN') ? targetHn.slice(2).trim() : targetHn;
      logClientEvent({
        level: 'Warning',
        component: 'Clinical_Treatment',
        message: `กดประเมิน AVPU/O₂ ต่อจากแจ้งเตือนพารามิเตอร์วิกฤต (+3 คะแนน): ผู้ป่วย HN ${cleanHn} (NEWS = ${alertNewsScore}) โดย ${actorName}`,
        details: {
          event: 'single_param_alert_assess_pending',
          hn: targetHn,
          vn: patient?.vn || undefined,
          news_score: alertNewsScore,
          critical_parameters: criticalParams.map((c) => c.parameter),
          actor: actorName,
        },
      });
    }
    if (targetPatientId) {
      selectPatient(targetPatientId);
    }
    openModal('avpu_assessment', {
      patientId: targetPatientId,
      hn: targetHn,
      gcs: patient?.latestVitals?.gcs ?? 15,
      patientName: patient?.fullName || maskHN(targetHn),
    });
  };

  const handleAcknowledge = () => {
    dismissSingleAlert();
    const curUser = useRTSASStore.getState().currentUser;
    const actorName = curUser?.name || 'พยาบาลวิชาชีพ';
    if (targetHn) {
      const cleanHn = targetHn.toUpperCase().startsWith('HN') ? targetHn.slice(2).trim() : targetHn;
      logClientEvent({
        level: 'Warning',
        component: 'Clinical_Treatment',
        message: `กดรับทราบแจ้งเตือนพารามิเตอร์วิกฤต (+3 คะแนน): ผู้ป่วย HN ${cleanHn} (NEWS = ${alertNewsScore}) โดย ${actorName}`,
        details: {
          event: 'single_param_alert_acknowledged',
          hn: targetHn,
          vn: patient?.vn || undefined,
          news_score: alertNewsScore,
          critical_parameters: criticalParams.map((c) => c.parameter),
          actor: actorName,
        },
      });
    }
    if (targetPatientId) {
      selectPatient(targetPatientId);
      const criticalSummary = criticalParams.length > 0
        ? criticalParams.map((cp) => `${PARAM_LABELS_TH[cp.parameter] || cp.label} (${cp.displayValue} +3)`).join(', ')
        : 'มีพารามิเตอร์ +3 คะแนน';
      useRTSASStore.getState().addTimelineEvent(
        `⚠️ รับทราบแจ้งเตือนพารามิเตอร์วิกฤต (+3 คะแนน): ${criticalSummary} (NEWS = ${alertNewsScore})`,
        'orange',
        actorName,
        { newsScore: alertNewsScore, criticalParameters: criticalParams.map((c) => c.parameter) },
        undefined,
        targetPatientId
      );
    }
    closeModal();
  };

  return (
    <SingleParamAlertModalContent
      patient={patient}
      alertHN={targetHn}
      alertNewsScore={alertNewsScore}
      onAcknowledge={handleAcknowledge}
      onAssessPending={handleAssessPending}
      onClose={handleClose}
    />
  );
}

export function SingleParamAlertModalContent({
  patient,
  alertHN,
  alertNewsScore,
  onAcknowledge,
  onAssessPending,
  onClose,
}: SingleParamAlertModalContentProps) {
  const genderLabel = patient?.gender === 'male' ? 'เพศชาย' : patient?.gender === 'female' ? 'เพศหญิง' : 'ไม่ระบุ';
  const arrivalTimeStr = patient
    ? new Date(patient.arrivalTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';

  const breakdownItems = filterDisplayBreakdownItems(patient?.latestNewsResult?.breakdown);
  const criticalParams = breakdownItems.filter((p) => p.score === 3);

  const needsAdditionalAssessment = Boolean(
    patient?.latestNewsResult?.needsAvpuPrompt || patient?.latestNewsResult?.needsOxygenPrompt
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(15, 23, 42, 0.72)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="animate-slideUp"
        style={{
          width: '540px',
          maxWidth: '95vw',
          background: '#fff',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px -12px rgba(15, 23, 42, .45), 0 0 0 1px rgba(148, 163, 184, .25)',
        }}
      >
        {/* Top Slate/Amber Accent Bar */}
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #334155, #f59e0b, #dc2626)' }} />

        {/* Distinct Slate Header (separated from red Sepsis Alert) */}
        <div style={{
          padding: '20px 24px 16px',
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          display: 'flex', alignItems: 'flex-start', gap: '14px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.35)',
        }}>
          <div style={{
            width: '50px', height: '50px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', flexShrink: 0,
            boxShadow: '0 6px 20px rgba(245, 158, 11, .35)',
          }}>
            ⚠️
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '17px', fontWeight: 900, color: '#fff', letterSpacing: '-0.2px', lineHeight: 1.3 }}>
              ⚠️ แจ้งเตือนพารามิเตอร์วิกฤต (+3 คะแนน)
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px', lineHeight: 1.5 }}>
              พบพารามิเตอร์เดี่ยวอยู่ในเกณฑ์ +3 คะแนน (คะแนนรวม NEWS ยังไม่ถึงเกณฑ์ Sepsis ≥ 5)
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '34px', height: '34px', borderRadius: '10px',
              border: '1px solid rgba(148, 163, 184, 0.4)', background: 'rgba(255, 255, 255, 0.08)',
              color: '#e2e8f0', fontSize: '15px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit', flexShrink: 0,
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px 24px' }}>
          {/* Patient Info Card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 16px', borderRadius: '14px',
            background: '#f8fafc',
            border: '1px solid #cbd5e1', marginBottom: '16px',
          }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: '#fff', border: '1.5px solid #cbd5e1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', flexShrink: 0,
            }}>👤</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.2px' }}>
                {maskHN(alertHN || 'N/A')}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                {genderLabel}{patient?.age ? ` · อายุ ${patient.age} ปี` : ''} · เวลาคัดกรอง {arrivalTimeStr}
              </div>
              {patient?.chiefComplaint && patient.chiefComplaint !== 'ไม่ระบุ' && (
                <div style={{
                  fontSize: '11px', color: '#334155', marginTop: '5px',
                  lineHeight: 1.45, wordBreak: 'break-word', overflowWrap: 'break-word',
                  whiteSpace: 'normal', background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: '6px', padding: '4px 8px',
                }}>
                  <span style={{ fontWeight: 700 }}>🩺 อาการสำคัญ: </span>
                  <span>{patient.chiefComplaint}</span>
                </div>
              )}
            </div>
            <div style={{
              fontSize: '10px', fontWeight: 800, color: '#b45309',
              background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '8px',
              padding: '6px 10px', textAlign: 'center', lineHeight: 1.45,
              flexShrink: 0,
            }}>
              ⚠️ เฝ้าระวัง<br />พารามิเตอร์ +3
            </div>
          </div>

          {/* Score & All Parameters Breakdown (RED ONLY on <=3 score badge and +3 param chips) */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            padding: '14px 16px', borderRadius: '14px',
            background: '#f8fafc', border: '1px solid #cbd5e1', marginBottom: '14px',
          }}>
            <div
              data-testid="single-param-score-badge"
              style={{
                width: '68px', height: '68px', borderRadius: '16px',
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 14px rgba(220, 38, 38, .3)',
              }}
            >
              <span style={{ fontSize: '32px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                {alertNewsScore}
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                NEWS Score (Single-Parameter Alert)
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#dc2626', marginTop: '3px' }}>
                {alertNewsScore <= 3
                  ? '🔴 คะแนนรวม ≤ 3 (มีพารามิเตอร์ +3)'
                  : `🔴 มีพารามิเตอร์เดี่ยว +3 คะแนน (NEWS = ${alertNewsScore})`}
              </div>

              <NewsBreakdownChips items={breakdownItems} neutralBg="#ffffff" />
            </div>
          </div>

          {/* Prominent Red Box listing exact +3 parameters */}
          {criticalParams.length > 0 && (
            <div
              data-testid="single-param-critical-box"
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: '#fef2f2',
                border: '1.5px solid #dc2626',
                marginBottom: '14px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#b91c1c', marginBottom: '8px' }}>
                🚨 พารามิเตอร์ที่เข้าเงื่อนไข (+3 คะแนน)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {criticalParams.map((cp) => (
                  <div
                    key={cp.parameter}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      background: '#fff',
                      border: '1px solid #fca5a5',
                      borderRadius: '8px',
                      padding: '8px 10px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#991b1b' }}>
                        {PARAM_LABELS_TH[cp.parameter] || cp.label}: {cp.displayValue}
                      </div>
                      {CRITICAL_PARAM_THRESHOLDS_TH[cp.parameter] && (
                        <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '2px' }}>
                          {CRITICAL_PARAM_THRESHOLDS_TH[cp.parameter]}
                        </div>
                      )}
                    </div>
                    <span style={{
                      background: '#dc2626',
                      color: '#fff',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                    }}>
                      +3 คะแนน
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clinical Guidance Banner */}
          <div style={{
            padding: '10px 14px', borderRadius: '12px',
            background: '#fffbeb', border: '1px solid #fde68a', marginBottom: '18px',
            fontSize: '11.5px', color: '#78350f', lineHeight: 1.65,
          }}>
            <strong style={{ color: '#b45309' }}>คำแนะนำทางคลินิก (NEWS 2012 Low–Medium Risk):</strong> คะแนนรวมยังไม่ถึงเกณฑ์เสี่ยง Sepsis (≥ 5) จึง<strong>ยังไม่เริ่มจับเวลา 60 นาที</strong> กรุณาประเมินอาการใกล้ชิดตามพารามิเตอร์ที่ผิดปกติและประเมินสัญญาณชีพซ้ำทันทีหากมีการเปลี่ยนแปลง
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {needsAdditionalAssessment && (
              <button
                type="button"
                id="single-param-assess-pending-btn"
                onClick={onAssessPending}
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: '12px',
                  fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                  color: '#fff', border: 'none',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, .25)',
                }}
              >
                💨 ระบุออกซิเจนเสริม / AVPU ต่อทันที
              </button>
            )}
            <button
              type="button"
              id="single-param-acknowledge-btn"
              onClick={onAcknowledge}
              style={{
                width: '100%', padding: '13px 14px', border: 'none', borderRadius: '12px',
                fontSize: '13.5px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                color: '#fff',
                background: 'linear-gradient(135deg, #334155, #1e293b)',
                boxShadow: '0 6px 18px -4px rgba(15, 23, 42, .35)',
              }}
            >
              ✅ รับทราบ — ติดตามอาการตามพารามิเตอร์ที่แจ้งเตือน
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
