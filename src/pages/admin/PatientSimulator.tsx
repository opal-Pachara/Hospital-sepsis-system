import { useState, useMemo } from 'react';
import { calculateNEWS } from '../../utils/newsCalculator';
import { gcsToAVPU } from '../../types';
import { showToast } from '../../components/common/Toast';
import { useRTSASStore } from '../../store/useRTSASStore';
import { mapBackendToPatient } from '../../utils/patientMapper';

interface PatientSimulatorProps {
  onNavigateClinical?: () => void;
}

export function PatientSimulator({ onNavigateClinical }: PatientSimulatorProps) {
  const [hn, setHn] = useState<string>(() => `HN${Math.floor(100000 + Math.random() * 900000)}`);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [age, setAge] = useState<number>(58);
  const [chiefComplaint, setChiefComplaint] = useState<string>('มีไข้สูง หนาวสั่น หายใจหอบเหนื่อย อ่อนเพลียมาก');

  // Vital Signs
  const [sbp, setSbp] = useState<number>(85);
  const [dbp, setDbp] = useState<number>(55);
  const [heartRate, setHeartRate] = useState<number>(124);
  const [respRate, setRespRate] = useState<number>(26);
  const [temperature, setTemperature] = useState<number>(39.2);
  const [spo2, setSpo2] = useState<number>(91);
  const [gcs, setGcs] = useState<number>(14);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastInjectedHn, setLastInjectedHn] = useState<string | null>(null);

  // Live NEWS Preview
  const liveNews = useMemo(() => {
    const vitals = {
      systolicBP: sbp || null,
      heartRate: heartRate || null,
      respiratoryRate: respRate || null,
      temperature: temperature || null,
      spO2: spo2 || null,
      oxygenSupplementation: 'room_air' as const,
      gcs: gcs || 15,
      avpu: gcsToAVPU(gcs || 15),
    };
    return calculateNEWS(vitals);
  }, [sbp, heartRate, respRate, temperature, spo2, gcs]);

  // Randomize HN
  const handleRandomizeHN = () => {
    setHn(`HN${Math.floor(100000 + Math.random() * 900000)}`);
  };

  // Quick Fill Presets
  const applyPreset = (preset: 'severe' | 'medium' | 'normal') => {
    handleRandomizeHN();
    if (preset === 'severe') {
      setGender('male');
      setAge(64);
      setChiefComplaint('ไข้สูง 39.2°C หนาวสั่น หายใจหอบเร็ว ความดันตก ซึมลง');
      setSbp(85);
      setDbp(50);
      setHeartRate(126);
      setRespRate(26);
      setTemperature(39.2);
      setSpo2(91);
      setGcs(14);
    } else if (preset === 'medium') {
      setGender('female');
      setAge(47);
      setChiefComplaint('ไข้ 2 วัน ไอ เสมหะสีเหลือง หายใจเหนื่อยเล็กน้อย');
      setSbp(112);
      setDbp(70);
      setHeartRate(104);
      setRespRate(22);
      setTemperature(38.4);
      setSpo2(95);
      setGcs(15);
    } else {
      setGender('male');
      setAge(35);
      setChiefComplaint('ปวดแผลเย็บบริเวณแขน มาล้างแผล ไม่มีไข้');
      setSbp(120);
      setDbp(80);
      setHeartRate(76);
      setRespRate(16);
      setTemperature(36.8);
      setSpo2(99);
      setGcs(15);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hn.trim()) {
      showToast('กรุณาระบุรหัสผู้ป่วย (HN)', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        hn: hn.trim(),
        sex: gender,
        age: Number(age) || null,
        chief_complaint: chiefComplaint.trim(),
        sbp: Number(sbp) || null,
        dbp: Number(dbp) || null,
        heart_rate: Number(heartRate) || null,
        resp_rate: Number(respRate) || null,
        temperature: Number(temperature) || null,
        spo2: Number(spo2) || null,
        gcs: Number(gcs) || null,
      };

      const res = await fetch('/api/admin/insert-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setLastInjectedHn(hn);

      // Immediately sync inserted patient to client store
      if (data?.patient) {
        try {
          const mapped = mapBackendToPatient(data.patient);
          const current = useRTSASStore.getState().patients;
          const exists = current.some((p) => p.id === mapped.id || p.hn === mapped.hn);
          if (!exists) {
            useRTSASStore.getState().setPatients([mapped, ...current]);
          } else {
            useRTSASStore.getState().setPatients(
              current.map((p) => (p.id === mapped.id || p.hn === mapped.hn ? { ...p, ...mapped } : p))
            );
          }
        } catch (syncErr) {
          console.warn('Could not sync inserted patient to store:', syncErr);
        }
      }

      showToast(`✅ บันทึกข้อมูลผู้ป่วย ${hn} ลงฐานข้อมูล MySQL เรียบร้อยแล้ว (NEWS ${liveNews.totalScore})`, 'success', 5000);
      // Generate next random HN for convenience
      handleRandomizeHN();
    } catch (err: any) {
      console.error('Failed to insert patient:', err);
      showToast(`ไม่สามารถบันทึกข้อมูลผู้ป่วยได้: ${err.message || err}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isHighRisk = liveNews.totalScore >= 5 || liveNews.riskLevel === 'high';
  const isMediumRisk = liveNews.riskLevel === 'medium' || liveNews.riskLevel === 'low_medium';

  return (
    <div className="flex flex-col gap-5">
      {/* ─── Top Presets Bar ─── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              ⚡ ตัวอย่างชุดข้อมูลสัญญาณชีพด่วน (Quick Vitals Presets)
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              คลิกเพื่อใส่ค่าสัญญาณชีพตัวอย่างตามมาตรฐาน NEWS หรือกรอกตัวเลขจริงในช่องด้านล่าง
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => applyPreset('severe')}
              className="px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 flex items-center gap-1.5 shadow-xs"
            >
              <span>🚨</span>
              <span>วิกฤต Sepsis (NEWS 9+)</span>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('medium')}
              className="px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 flex items-center gap-1.5 shadow-xs"
            >
              <span>⚠️</span>
              <span>เสี่ยงปานกลาง/มีไข้ (NEWS 4)</span>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('normal')}
              className="px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1.5 shadow-xs"
            >
              <span>🟢</span>
              <span>สัญญาณชีพปกติ (NEWS 0)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Form & Live Score Grid ─── */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (8 cols): Input Fields */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Patient Demographics Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-sm font-black text-slate-800 flex items-center gap-2">
                <span>👤</span> ข้อมูลผู้ป่วยแรกรับ (Patient Demographics)
              </span>
              <button
                type="button"
                onClick={handleRandomizeHN}
                className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>🎲</span> สุ่มเลข HN ใหม่
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  รหัสผู้ป่วย (HN) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={hn}
                  onChange={(e) => setHn(e.target.value)}
                  className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">เพศ</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                    className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="male">ชาย ♂</option>
                    <option value="female">หญิง ♀</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">อายุ (ปี)</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                อาการสำคัญแรกรับ (Chief Complaint)
              </label>
              <textarea
                rows={2}
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="ระบุอาการแรกรับที่ห้องฉุกเฉิน..."
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-colors resize-none"
              />
            </div>
          </div>

          {/* Vital Signs Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <span className="text-sm font-black text-slate-800 flex items-center gap-2">
                <span>🩺</span> สัญญาณชีพแรกรับ (Vital Signs Inputs)
              </span>
              <span className="text-[11px] text-slate-400">ระบบจะคำนวณ NEWS สดทันทีที่กรอก</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {/* SBP */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">ความดันตัวบน (SBP)</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="number"
                    min="40"
                    max="280"
                    value={sbp}
                    onChange={(e) => setSbp(Number(e.target.value))}
                    className="w-full text-lg font-black text-slate-800 bg-white border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <span className="text-xs text-slate-500 font-medium">mmHg</span>
                </div>
              </div>

              {/* DBP */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">ความดันตัวล่าง (DBP)</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="number"
                    min="20"
                    max="180"
                    value={dbp}
                    onChange={(e) => setDbp(Number(e.target.value))}
                    className="w-full text-lg font-black text-slate-800 bg-white border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <span className="text-xs text-slate-500 font-medium">mmHg</span>
                </div>
              </div>

              {/* Heart Rate */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">ชีพจร (Heart Rate)</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="number"
                    min="20"
                    max="240"
                    value={heartRate}
                    onChange={(e) => setHeartRate(Number(e.target.value))}
                    className="w-full text-lg font-black text-slate-800 bg-white border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <span className="text-xs text-slate-500 font-medium">bpm</span>
                </div>
              </div>

              {/* Resp Rate */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">อัตราหายใจ (Resp Rate)</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={respRate}
                    onChange={(e) => setRespRate(Number(e.target.value))}
                    className="w-full text-lg font-black text-slate-800 bg-white border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <span className="text-xs text-slate-500 font-medium">/min</span>
                </div>
              </div>

              {/* Temp */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">อุณหภูมิ (Temp)</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="number"
                    step="0.1"
                    min="32"
                    max="43"
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="w-full text-lg font-black text-slate-800 bg-white border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <span className="text-xs text-slate-500 font-medium">°C</span>
                </div>
              </div>

              {/* SpO2 */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">ออกซิเจนในเลือด (SpO₂)</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={spo2}
                    onChange={(e) => setSpo2(Number(e.target.value))}
                    className="w-full text-lg font-black text-slate-800 bg-white border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <span className="text-xs text-slate-500 font-medium">%</span>
                </div>
              </div>

              {/* GCS */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 sm:col-span-2">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">ระดับความรู้สึกตัว (GCS: 3-15)</span>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="range"
                    min="3"
                    max="15"
                    value={gcs}
                    onChange={(e) => setGcs(Number(e.target.value))}
                    className="flex-1 cursor-pointer"
                  />
                  <span className="text-base font-black text-slate-800 font-mono w-10 text-center">
                    {gcs}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">
                    {gcs === 15 ? 'Alert (A)' : gcs >= 13 ? 'Voice (V)' : gcs >= 9 ? 'Pain (P)' : 'Unresponsive (U)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Live Score Card & Dispatch Action */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Live NEWS Score Card */}
          <div
            className={`border rounded-2xl p-5 shadow-xs transition-all ${
              isHighRisk
                ? 'bg-gradient-to-br from-red-50 to-red-100/60 border-red-200'
                : isMediumRisk
                ? 'bg-gradient-to-br from-amber-50 to-amber-100/60 border-amber-200'
                : 'bg-gradient-to-br from-emerald-50 to-emerald-100/60 border-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                📊 ผลการประเมินสด (Live NEWS)
              </span>
              <span
                className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                  isHighRisk
                    ? 'bg-red-600 text-white'
                    : isMediumRisk
                    ? 'bg-amber-500 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {liveNews.riskLevel.toUpperCase()}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-3">
              <span
                className={`text-5xl font-black font-mono ${
                  isHighRisk ? 'text-red-700' : isMediumRisk ? 'text-amber-800' : 'text-emerald-700'
                }`}
              >
                {liveNews.totalScore}
              </span>
              <span className="text-sm font-semibold text-slate-500">คะแนน (Points)</span>
            </div>

            <div className="text-xs font-medium text-slate-600 mt-2">
              {isHighRisk
                ? '🚨 เข้าเกณฑ์เตือนภัย Sepsis Alert (NEWS ≥ 5) — ระบบจะส่งเสียงและเปิดหน้าต่างแจ้งเตือนฉุกเฉินบนจอติดตามผู้ป่วยสด'
                : isMediumRisk
                ? '⚠️ เฝ้าระวังระดับปานกลาง — ผู้ป่วยต้องได้รับการติดตามสัญญาณชีพซ้ำ'
                : '🟢 สัญญาณชีพอยู่ในเกณฑ์ปกติ'}
            </div>

            {/* Parameter Score Breakdown */}
            <div className="mt-4 pt-3 border-t border-slate-200/60 flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase">แต้มแยกรายพารามิเตอร์:</span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {liveNews.breakdown.map((b) => (
                  <div
                    key={b.parameter}
                    className={`flex items-center justify-between px-2 py-1 rounded-md text-[11px] ${
                      b.score > 0
                        ? b.score === 3
                          ? 'bg-red-200/80 font-bold text-red-900'
                          : 'bg-amber-100 font-semibold text-amber-900'
                        : 'bg-white/70 text-slate-600'
                    }`}
                  >
                    <span>{b.label}:</span>
                    <span className="font-mono font-bold">+{b.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 px-4 rounded-xl text-sm font-black text-white cursor-pointer transition-all shadow-md flex items-center justify-center gap-2 ${
                isHighRisk
                  ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-red-500/25'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-blue-500/25'
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">🔄</span>
                  <span>กำลังบันทึกลงฐานข้อมูล MySQL...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>บันทึกข้อมูลผู้ป่วยลงฐานข้อมูล MySQL</span>
                </>
              )}
            </button>

            <div className="text-[11px] text-slate-500 text-center leading-relaxed">
              📡 ข้อมูลจะถูกบันทึกจริงลงในตาราง <code>patient_visits</code> และ <code>opdscreen</code> ใน MySQL พร้อมคำนวณ NEWS และซิงค์สด
            </div>

            {lastInjectedHn && onNavigateClinical && (
              <div className="mt-2 pt-3 border-t border-slate-100 flex flex-col gap-2">
                <div className="text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                  <span>✅</span> บันทึกผู้ป่วย {lastInjectedHn} ลงฐานข้อมูลเรียบร้อยแล้ว
                </div>
                <button
                  type="button"
                  onClick={() => {
                    useRTSASStore.getState().selectPatient(lastInjectedHn);
                    onNavigateClinical();
                  }}
                  className="w-full py-2 px-3 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>🏥</span>
                  <span>เปิดดูผลบนจอติดตามผู้ป่วยสด (ER Bedside)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
