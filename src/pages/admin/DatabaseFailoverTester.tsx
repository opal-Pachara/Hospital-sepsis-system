import { useState, useEffect, useCallback, useRef } from 'react';
import { showToast } from '../../components/common/Toast';

interface SystemLogItem {
  id: string | number;
  timestamp: string;
  level: string;
  message: string;
  component?: string;
  details?: any;
}

interface DBStatusData {
  status: string;
  pool_available: boolean;
  latency_ms?: number | null;
  host?: string;
  port?: number;
  database?: string;
  pool_size?: number;
  pool_free?: number;
}

export function DatabaseFailoverTester() {
  const [dbStatus, setDbStatus] = useState<DBStatusData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<SystemLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [logFilter, setLogFilter] = useState<'ALL' | 'ERROR' | 'Warning' | 'Note'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch DB Status
  const fetchDbStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/db-status');
      if (res.ok) {
        const data: DBStatusData = await res.json();
        setDbStatus(data);
      }
    } catch {
      setDbStatus({
        status: 'network error',
        pool_available: false,
      });
    }
  }, []);

  // Fetch Logs
  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/system/logs?limit=100');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setLastRefreshedAt(new Date());
      }
    } catch (err) {
      console.warn('Failed to fetch system logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  // Initial and Auto-refresh interval
  useEffect(() => {
    fetchDbStatus();
    fetchLogs();

    if (autoRefresh) {
      timerRef.current = setInterval(() => {
        fetchDbStatus();
        fetchLogs();
      }, 3000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchDbStatus, fetchLogs, autoRefresh]);

  const [confirmDisconnect, setConfirmDisconnect] = useState<boolean>(false);

  // Physical Disconnect Database
  const handlePhysicalDisconnect = async () => {
    setConfirmDisconnect(false);
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/disconnect-db', { method: 'POST' });
      if (res.ok) {
        showToast('🔴 ตัดการเชื่อมต่อฐานข้อมูล MySQL จริงเรียบร้อยแล้ว — สังเกตการตอบสนองของระบบใน Logs', 'error', 6000);
        await fetchDbStatus();
        await fetchLogs();
      } else {
        showToast('เกิดข้อผิดพลาดในการสั่งตัดการเชื่อมต่อ', 'error');
      }
    } catch (err: any) {
      showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Physical Reconnect Database
  const handlePhysicalReconnect = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/reconnect-db', { method: 'POST' });
      if (res.ok) {
        showToast('🟢 เชื่อมต่อฐานข้อมูล MySQL คืนสู่สถานะปกติเรียบร้อยแล้ว', 'success', 5000);
        await fetchDbStatus();
        await fetchLogs();
      } else {
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อใหม่', 'error');
      }
    } catch (err: any) {
      showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear Logs
  const handleClearLogs = async () => {
    if (!window.confirm('ต้องการล้างบันทึกเหตุการณ์ (Logs) ทั้งหมดใช่หรือไม่?')) return;
    try {
      const res = await fetch('/api/system/logs/clear', { method: 'POST' });
      if (res.ok) {
        showToast('ล้างบันทึกเหตุการณ์เรียบร้อยแล้ว', 'info');
        await fetchLogs();
      }
    } catch (err: any) {
      showToast(`ล้าง Logs ไม่สำเร็จ: ${err.message}`, 'error');
    }
  };

  const isConnected = dbStatus?.status === 'connected' && dbStatus?.pool_available;

  // Filter logs
  const filteredLogs = logs.filter((l) => {
    if (logFilter !== 'ALL' && l.level.toUpperCase() !== logFilter.toUpperCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMsg = l.message.toLowerCase().includes(q);
      const matchComp = (l.component || '').toLowerCase().includes(q);
      return matchMsg || matchComp;
    }
    return true;
  });

  const errorCount = logs.filter((l) => l.level.toUpperCase() === 'ERROR').length;
  const warnCount = logs.filter((l) => l.level.toUpperCase().includes('WARN')).length;
  const noteCount = logs.filter((l) => l.level.toUpperCase() === 'NOTE' || l.level.toUpperCase() === 'INFO').length;

  return (
    <div className="flex flex-col gap-5">
      {/* ─── Physical DB Connection Overview ─── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0 shadow-md ${
                isConnected
                  ? 'bg-emerald-600 text-white shadow-emerald-500/25'
                  : 'bg-red-600 text-white shadow-red-500/25 animate-pulse'
              }`}
            >
              {isConnected ? '🗄️' : '⚠️'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-slate-800 tracking-tight">
                  สถานะการเชื่อมต่อฐานข้อมูล HOSxP MySQL (Physical Database Status)
                </span>
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                    isConnected
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {isConnected ? 'LIVE CONNECTED' : 'PHYSICALLY DISCONNECTED'}
                </span>
              </div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">
                Host: <strong>{dbStatus?.host || '127.0.0.1'}</strong> : {dbStatus?.port || 3306} · ฐานข้อมูล: <strong>{dbStatus?.database || 'sepsis_db'}</strong>
                {dbStatus?.latency_ms != null && (
                  <span className="ml-2 text-emerald-600 font-bold">· Latency: {dbStatus.latency_ms} ms</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchDbStatus}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
            >
              <span>🔄</span>
              <span>ตรวจสอบสัญญาณ Ping</span>
            </button>
          </div>
        </div>

        {/* ─── Metric Badges ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="text-[11px] font-bold text-slate-400 uppercase">สถานะ Connection Pool</div>
            <div className={`text-sm font-black mt-0.5 ${isConnected ? 'text-emerald-600' : 'text-red-600'}`}>
              {isConnected ? '🟢 พร้อมใช้งาน (Ready)' : '🔴 ปิดการเชื่อมต่อ (Pool Closed)'}
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Pool Connections</div>
            <div className="text-sm font-black text-slate-700 mt-0.5">
              {dbStatus?.pool_free ?? 0} ว่าง / {dbStatus?.pool_size ?? 0} รวม
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="text-[11px] font-bold text-slate-400 uppercase">โหมดระบบสำรอง</div>
            <div className={`text-sm font-black mt-0.5 ${isConnected ? 'text-slate-600' : 'text-amber-600 font-black'}`}>
              {isConnected ? 'Normal Mode' : '🛡️ Safe Offline Buffer'}
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Background Scheduler</div>
            <div className="text-sm font-black text-blue-600 mt-0.5">
              Sync ทุก 10 วินาที
            </div>
          </div>
        </div>
      </div>

      {/* ─── Real Disconnect / Reconnect Controls ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Physical Disconnect Button */}
        <div
          className={`p-5 rounded-2xl border transition-all shadow-xs flex flex-col justify-between ${
            !isConnected
              ? 'bg-slate-50 border-slate-200 opacity-70'
              : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200 hover:shadow-md hover:border-red-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center text-lg font-bold">
                🔌
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-200 text-red-800">
                Physical Action
              </span>
            </div>
            <div className="text-sm font-black text-red-900">
              ตัดการเชื่อมต่อฐานข้อมูลจริง (Physical Disconnect)
            </div>
            <p className="text-xs text-red-700/90 leading-relaxed mt-1.5">
              สั่งปิด MySQL Connection Pool ทันที ระบบจะไม่สามารถอ่าน/เขียนฐานข้อมูลได้ และจะบันทึกข้อผิดพลาด (CRITICAL ERROR) ลงใน Logs ระบบแบบสดทุก 10 วินาที
            </p>
          </div>
          {confirmDisconnect ? (
            <div className="mt-4 flex flex-col gap-2">
              <div className="text-[11px] font-bold text-red-800 bg-red-100/80 px-2.5 py-1.5 rounded-lg border border-red-200">
                ⚠️ ยืนยันการตัดการเชื่อมต่อจริง? ระบบจะปิด MySQL Connection Pool ทันที
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-real-disconnect-confirm"
                  onClick={handlePhysicalDisconnect}
                  disabled={isLoading}
                  className="flex-1 py-2 px-3 rounded-xl text-xs font-black bg-red-700 hover:bg-red-800 text-white cursor-pointer shadow-md shadow-red-600/30 flex items-center justify-center gap-1.5 transition-all"
                >
                  <span>⚠️ ยืนยันตัดการเชื่อมต่อ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDisconnect(false)}
                  className="py-2 px-3 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer transition-all"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              id="btn-real-disconnect"
              onClick={() => setConfirmDisconnect(true)}
              disabled={isLoading || !isConnected}
              className={`mt-4 w-full py-2.5 px-4 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center justify-center gap-2 shadow-xs ${
                !isConnected
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/25'
              }`}
            >
              <span>💥</span>
              <span>ตัดการเชื่อมต่อฐานข้อมูลเดี๋ยวนี้</span>
            </button>
          )}
        </div>

        {/* Physical Reconnect Button */}
        <div
          className={`p-5 rounded-2xl border transition-all shadow-xs flex flex-col justify-between ${
            isConnected
              ? 'bg-slate-50 border-slate-200 opacity-70'
              : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 hover:shadow-md hover:border-emerald-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-bold">
                🔄
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-200 text-emerald-800">
                Physical Action
              </span>
            </div>
            <div className="text-sm font-black text-emerald-900">
              เชื่อมต่อฐานข้อมูลใหม่ (Reconnect Database)
            </div>
            <p className="text-xs text-emerald-700/90 leading-relaxed mt-1.5">
              สั่งเปิด Connection Pool ไปยัง MySQL อีกครั้ง พร้อมทดสอบ Handshake คำสั่ง SELECT 1 เพื่อคืนสู่สถานะปกติ และบันทึก Logs ยืนยันการเชื่อมต่อสำเร็จ
            </p>
          </div>
          <button
            type="button"
            id="btn-real-reconnect"
            onClick={handlePhysicalReconnect}
            disabled={isLoading || isConnected}
            className={`mt-4 w-full py-2.5 px-4 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center justify-center gap-2 shadow-xs ${
              isConnected
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25'
            }`}
          >
            <span>🟢</span>
            <span>{isLoading ? 'กำลังดำเนินการ...' : 'กู้คืนการเชื่อมต่อฐานข้อมูล'}</span>
          </button>
        </div>
      </div>

      {/* ─── Real-time System Logs Viewer ─── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📜</span>
            <div>
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                บันทึกเหตุการณ์และการตอบสนองของระบบ (Real-Time System Diagnostics Logs)
              </span>
              <span className="block text-[11px] text-slate-400 mt-0.5">
                อัปเดตล่าสุด: {lastRefreshedAt.toLocaleTimeString('th-TH')} · ทั้งหมด {logs.length} รายการ
              </span>
            </div>
          </div>

          {/* Controls: Auto-refresh, Manual refresh, Clear */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer font-bold select-none bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="cursor-pointer"
              />
              <span>Auto-refresh (3s)</span>
            </label>

            <button
              type="button"
              onClick={fetchLogs}
              disabled={loadingLogs}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
            >
              <span>🔄</span>
              <span>{loadingLogs ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
            </button>

            <button
              type="button"
              onClick={handleClearLogs}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 cursor-pointer transition-all border border-red-200"
              title="ล้างข้อมูล Logs ทั้งหมด"
            >
              <span>🗑️ ล้าง Logs</span>
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          {/* Level Filter Pills */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLogFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                logFilter === 'ALL'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setLogFilter('ERROR')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                logFilter === 'ERROR'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              🔴 ERROR ({errorCount})
            </button>
            <button
              type="button"
              onClick={() => setLogFilter('Warning')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                logFilter === 'Warning'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              🟡 Warning ({warnCount})
            </button>
            <button
              type="button"
              onClick={() => setLogFilter('Note')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                logFilter === 'Note'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              🟢 Note ({noteCount})
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาใน Logs..."
              className="px-3 py-1 text-xs border border-slate-200 rounded-lg w-48 sm:w-64 focus:outline-hidden focus:border-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto max-h-[440px] border border-slate-100 rounded-xl mt-1">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">
              ไม่มีข้อมูล Logs ที่ตรงกับเงื่อนไข
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                <tr className="text-[11px] font-bold text-slate-500 uppercase">
                  <th className="py-2.5 px-3">เวลา (Timestamp)</th>
                  <th className="py-2.5 px-3">ระดับ</th>
                  <th className="py-2.5 px-3">โมดูล (Component)</th>
                  <th className="py-2.5 px-3">รายละเอียดเหตุการณ์</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const isErr = log.level.toUpperCase() === 'ERROR';
                  const isWarn = log.level.toUpperCase().includes('WARN');
                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isErr ? 'bg-red-50/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isErr
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : isWarn
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-blue-100 text-blue-700 border-blue-200'
                          }`}
                        >
                          {log.level}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px]">
                          {log.component || 'System'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 font-medium">
                        <div>{log.message}</div>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <details className="mt-1 group">
                            <summary className="text-[10px] font-mono text-blue-600 hover:text-blue-800 cursor-pointer select-none">
                              🔍 รายละเอียด ({log.details.patients ? `${log.details.patients.length} เคส` : Object.keys(log.details).length + ' ข้อมูล'})
                            </summary>
                            <pre className="text-[10px] font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded p-2 mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
