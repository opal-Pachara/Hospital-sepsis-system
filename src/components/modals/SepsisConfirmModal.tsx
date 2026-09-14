import { useState, useEffect, useMemo } from 'react';
import { useRTSASStore } from '../../store/useRTSASStore';
import { maskHN } from '../../utils/hnMask';
import { showToast } from '../common/Toast';

export default function SepsisConfirmModal() {
  const { ui, closeModal, selectedPatient, completeChecklistItem, currentUser } = useRTSASStore();
  const isOpen = ui.modal.activeModal === 'sepsis_confirm';

  // Format current local time HH:mm for default input
  const getNowTimeString = () => {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const [confirmTimeStr, setConfirmTimeStr] = useState<string>(getNowTimeString());
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Reset inputs when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setConfirmTimeStr(getNowTimeString());
    setErrorMessage('');
  }, [isOpen, currentUser, selectedPatient]);

  // Calculate live preview metrics
  const preview = useMemo(() => {
    if (!isOpen || !confirmTimeStr) return null;
    const parts = confirmTimeStr.split(':');
    if (parts.length !== 2) return null;

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return null;

    const now = new Date();
    const confirmedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

    // Handle case if chosen time is ahead of current time
    const diffMs = now.getTime() - confirmedDate.getTime();
    const isFuture = diffMs < -60000; // allow small 1-minute clock drift
    const elapsedSecs = Math.max(0, Math.floor(diffMs / 1000));
    const elapsedMins = Math.floor(elapsedSecs / 60);

    const remainingSecs = Math.max(0, 3600 - elapsedSecs);
    const remainingMins = Math.floor(remainingSecs / 60);
    const remainingSecRemainder = remainingSecs % 60;
    const isExpired = elapsedSecs >= 3600;

    return {
      confirmedDate,
      isFuture,
      elapsedMins,
      remainingMins,
      remainingSecRemainder,
      isExpired,
      isoString: confirmedDate.toISOString(),
    };
  }, [isOpen, confirmTimeStr]);

  if (!isOpen) return null;


  const handleConfirm = () => {
    if (!preview) {
      setErrorMessage('กรุณาระบุเวลาที่แพทย์ยืนยันภาวะติดเชื้อ');
      return;
    }

    if (preview.isFuture) {
      setErrorMessage('ไม่สามารถเลือกเวลาในอนาคตได้ กรุณาระบุเวลาปัจจุบันหรือเวลาย้อนหลัง');
      return;
    }

    // 1. Complete doctor_confirm checklist item with custom clinical confirmation time
    // Note: Doctor confirm is always attributed to 'แพทย์เวร ER' without login/doctor names in Timeline
    completeChecklistItem(
      'doctor_confirm',
      'แพทย์เวร ER',
      undefined,
      preview.isoString
    );

    // 2. Dismiss alert & sync acknowledgement to MySQL
    if (selectedPatient) {
      useRTSASStore.getState().markAlertDismissed(selectedPatient.hn);

      fetch('/api/treatment-status/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hn: selectedPatient.hn,
          acknowledged_by: 'แพทย์เวร ER',
          vn: selectedPatient.vn,
        }),
      }).catch((err) => console.warn('[SepsisConfirmModal] Acknowledge sync error:', err));

      fetch('/api/treatment-status/doctor-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hn: selectedPatient.hn,
          confirmed_by: 'แพทย์เวร ER',
          physician: 'แพทย์เวร ER',
          confirmed_at: preview.isoString,
        }),
      }).catch((err) => console.warn('[SepsisConfirmModal] Doctor confirm sync error:', err));
    }

    showToast(`🔴 ยืนยัน Sepsis สำเร็จ — เริ่มนับเวลา 60 นาที (เวลาทางคลินิก: ${confirmTimeStr} น.)`, 'success');
    closeModal();
  };

  const patientDisplay = selectedPatient
    ? `${maskHN(selectedPatient.hn)}`
    : 'ผู้ป่วยฉุกเฉิน';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(10, 10, 20, 0.7)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        className="animate-slideUp"
        style={{
          width: '520px',
          maxWidth: '95vw',
          background: '#fff',
          borderRadius: '20px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -12px rgba(220, 38, 38, .35), 0 0 0 1px rgba(220, 38, 38, .15)',
        }}
      >
        {/* ─── Red Top Accent Bar ─── */}
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #dc2626, #f97316, #dc2626)', flexShrink: 0 }} />

        {/* ─── Header ─── */}
        <div
          style={{
            padding: '18px 24px 16px',
            background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 50%, #fef2f2 100%)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            borderBottom: '1px solid rgba(252, 165, 165, .6)',
            flexShrink: 0,
          }}
        >
          {/* Stethoscope Icon Box */}
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0,
              boxShadow: '0 6px 18px rgba(220, 38, 38, .35)',
            }}
          >
            🩺
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '17px', fontWeight: 900, color: '#dc2626', letterSpacing: '-0.3px', lineHeight: 1.3 }}>
              ยืนยันภาวะติดเชื้อในกระแสเลือด (Sepsis)
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px', lineHeight: 1.4 }}>
              จุดเริ่มนับเวลา 60-Minute Sepsis Bundle ตามการยืนยันทางคลินิก
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: '#fff',
              border: '1px solid rgba(252, 165, 165, .8)',
              color: '#dc2626',
              fontSize: '15px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'inherit',
              flexShrink: 0,
              transition: 'all 0.2s',
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#dc2626';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.color = '#dc2626';
            }}
          >
            ✕
          </button>
        </div>

        {/* ─── Body ─── */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, maxHeight: 'calc(90vh - 140px)' }}>
          {/* Patient Banner */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>ผู้ป่วย:</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginLeft: '6px' }}>
                {patientDisplay}
              </span>
            </div>
            {selectedPatient?.latestNewsScore !== undefined && (
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '20px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  fontSize: '11px',
                  fontWeight: 800,
                  border: '1px solid #fca5a5',
                }}
              >
                NEWS {selectedPatient.latestNewsScore}
              </span>
            )}
          </div>

          {/* Clinical Confirmation Time Input */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#334155',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>⏰</span>
              <span>เวลาที่แพทย์ยืนยันภาวะติดเชื้อทางคลินิก (Clinical Sepsis Time):</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                id="sepsis-confirm-time-input"
                type="time"
                value={confirmTimeStr}
                onChange={(e) => {
                  setConfirmTimeStr(e.target.value);
                  setErrorMessage('');
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#dc2626';
                  e.currentTarget.style.boxShadow = '0 0 0 4px rgba(220, 38, 38, .1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#0f172a',
                  width: '130px',
                  background: '#fff',
                  outline: 'none',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="button"
                onClick={() => setConfirmTimeStr(getNowTimeString())}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  background: '#eff6ff',
                  color: '#2563eb',
                  border: '1px solid #bfdbfe',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'inherit',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#dbeafe';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#eff6ff';
                }}
              >
                <span>🕒</span>
                <span>เวลานี้ ({getNowTimeString()} น.)</span>
              </button>
            </div>
            <p style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', lineHeight: 1.4 }}>
              * สามารถระบุเวลาย้อนหลังที่แพทย์ยืนยันจริงได้ โดยระบบจะคำนวณเวลานับถอยหลัง 60 นาที (Golden Hour) ต่อจากเวลาดังกล่าว
            </p>
          </div>

          {/* Live Golden Hour Countdown Preview */}
          {preview && !preview.isFuture && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '14px',
                background: preview.isExpired
                  ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
                  : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                border: `1px solid ${preview.isExpired ? '#fca5a5' : '#fde68a'}`,
                color: preview.isExpired ? '#991b1b' : '#92400e',
                marginBottom: '16px',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 800 }}>
                  ⏱️ การคำนวณเวลา Golden Hour (60 นาที):
                </span>
                {preview.isExpired ? (
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: '20px',
                      background: '#dc2626',
                      color: '#fff',
                      fontSize: '10.5px',
                      fontWeight: 800,
                    }}
                  >
                    หมดเวลา 60 นาทีแล้ว
                  </span>
                ) : (
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: '20px',
                      background: '#fef08a',
                      color: '#854d0e',
                      fontSize: '10.5px',
                      fontWeight: 800,
                      border: '1px solid #facc15',
                    }}
                  >
                    เหลือเวลา {preview.remainingMins} นาที {String(preview.remainingSecRemainder).padStart(2, '0')} วินาที
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '3px', opacity: 0.95, lineHeight: 1.5 }}>
                <div>• เวลายืนยันทางคลินิก: <strong>{confirmTimeStr} น.</strong></div>
                <div>• ผ่านไปแล้ว: <strong>{preview.elapsedMins} นาที</strong> นับตั้งแต่แพทย์ยืนยัน</div>
                {preview.isExpired && (
                  <div style={{ color: '#b91c1c', fontWeight: 700, marginTop: '4px' }}>
                    ⚠️ เวลายืนยันผ่านไปเกิน 60 นาทีแล้ว ระบบจะเริ่มนับและแสดงสถานะหมดเวลา เพื่อรักษาความถูกต้องของเวชระเบียน
                  </div>
                )}
              </div>
            </div>
          )}

          {preview?.isFuture && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                color: '#b91c1c',
                fontSize: '11.5px',
                fontWeight: 700,
                marginBottom: '16px',
              }}
            >
              ⚠️ ไม่สามารถระบุเวลาในอนาคตได้ (เกินเวลาปัจจุบัน)
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                color: '#b91c1c',
                fontSize: '11.5px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '12px',
              }}
            >
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div
          style={{
            padding: '14px 24px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={closeModal}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#475569',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#f1f5f9';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#fff';
            }}
          >
            ยกเลิก
          </button>
          <button
            id="btn-submit-sepsis-confirm"
            type="button"
            onClick={handleConfirm}
            disabled={preview?.isFuture}
            style={{
              padding: '9px 22px',
              borderRadius: '10px',
              border: 'none',
              background: preview?.isFuture
                ? '#cbd5e1'
                : 'linear-gradient(135deg, #dc2626, #b91c1c)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 800,
              cursor: preview?.isFuture ? 'not-allowed' : 'pointer',
              boxShadow: preview?.isFuture ? 'none' : '0 4px 14px rgba(220, 38, 38, .35)',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'inherit',
            }}
            onMouseOver={(e) => {
              if (!preview?.isFuture) {
                e.currentTarget.style.filter = 'brightness(1.08)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.filter = 'none';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <span>🔴</span>
            <span>บันทึกยืนยัน Sepsis & เริ่มนับเวลา</span>
          </button>
        </div>
      </div>
    </div>
  );
}
