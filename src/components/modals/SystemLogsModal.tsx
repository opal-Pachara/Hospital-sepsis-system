import { useState, useEffect, useRef } from 'react';

interface LogEntry {
  id: number;
  timestamp: string;
  pid: number;
  level: string;
  component: string;
  message: string;
  details?: Record<string, any>;
}

interface LogSummary {
  total_logs: number;
  error_logs: number;
  last_entry: {
    timestamp: string;
    level: string;
    component: string;
    message: string;
  } | null;
  log_db_path?: string;
}

interface SystemLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function JsonSyntaxViewer({ data }: { data: Record<string, any> }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  const jsonStr = JSON.stringify(data, null, 2);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(jsonStr);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const formatJson = (json: string) => {
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let color = '#cbd5e1';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            color = '#38bdf8'; // Key: bright sky blue
          } else {
            color = '#86efac'; // String: soft emerald green
          }
        } else if (/true|false/.test(match)) {
          color = '#c084fc'; // Boolean: purple
        } else if (/null/.test(match)) {
          color = '#f87171'; // Null: red
        } else {
          color = '#facc15'; // Number: warm yellow
        }
        return `<span style="color: ${color};">${match}</span>`;
      }
    );
  };

  // Quick summary pills for patients if available
  const patients = data.patients_breakdown || (data.hn ? [{ hn: data.hn, parameters: data.parameters }] : []);

  return (
    <div
      style={{
        marginTop: '6px',
        marginLeft: '24px',
        background: '#040711',
        borderRadius: '8px',
        border: '1px solid #1e293b',
        overflow: 'hidden',
        fontSize: '11px',
      }}
    >
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: '#0a101f',
          borderBottom: isExpanded ? '1px solid #1e293b' : 'none',
          cursor: 'pointer',
          userSelect: 'none',
          fontSize: '11px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'monospace' }}>
            {'{ }'} JSON ข้อมูลละเอียด
          </span>

          {/* Quick pills */}
          {Array.isArray(patients) && patients.slice(0, 3).map((p: any, idx: number) => {
            const hnStr = p.hn ? (String(p.hn).startsWith('HN') ? p.hn : `HN ${p.hn}`) : '';
            const params = p.parameters ? (Array.isArray(p.parameters) ? p.parameters.join(', ') : p.parameters) : '';
            if (!hnStr) return null;
            return (
              <span
                key={idx}
                style={{
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: '#7dd3fc',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                }}
              >
                {hnStr} {params ? `• [${params}]` : ''}
              </span>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              background: isCopied ? '#15803d' : '#1e293b',
              color: isCopied ? '#ffffff' : '#94a3b8',
              border: '1px solid #334155',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            title="คัดลอก JSON"
          >
            {isCopied ? '✓ คัดลอกแล้ว' : '📋 คัดลอก JSON'}
          </button>
          <span style={{ color: '#64748b', fontSize: '10px' }}>
            {isExpanded ? '▲ ย่อ' : '▼ ขยาย'}
          </span>
        </div>
      </div>

      {/* Formatted syntax-highlighted JSON */}
      {isExpanded && (
        <pre
          style={{
            margin: 0,
            padding: '10px 14px',
            overflowX: 'auto',
            fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            lineHeight: 1.5,
            color: '#cbd5e1',
          }}
          dangerouslySetInnerHTML={{ __html: formatJson(jsonStr) }}
        />
      )}
    </div>
  );
}

export default function SystemLogsModal({ isOpen, onClose }: SystemLogsModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<LogSummary | null>(null);
  const [dbStatus, setDbStatus] = useState<{ status: string; pool_available: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);
  const autoRefreshInterval = useRef<number | null>(null);

  const fetchLogsData = async () => {
    try {
      setIsLoading(true);
      const url = new URL('/api/system/logs', window.location.origin);
      url.searchParams.set('limit', '100');
      if (filterLevel !== 'ALL') {
        url.searchParams.set('level', filterLevel);
      }
      if (searchQuery.trim()) {
        url.searchParams.set('search', searchQuery.trim());
      }

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      }

      // Check DB health
      const healthRes = await fetch('/api/admin/db-status');
      if (healthRes.ok) {
        const hData = await healthRes.json();
        setDbStatus(hData);
      }
    } catch (err) {
      console.error('Failed to load system logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogsData();
    }
  }, [isOpen, filterLevel, searchQuery]);

  useEffect(() => {
    if (isOpen && autoRefresh) {
      autoRefreshInterval.current = window.setInterval(() => {
        fetchLogsData();
      }, 4000);
    }
    return () => {
      if (autoRefreshInterval.current) clearInterval(autoRefreshInterval.current);
      autoRefreshInterval.current = null;
    };
  }, [isOpen, autoRefresh]);

  if (!isOpen) return null;

  const handleCopyLogs = () => {
    const text = logs
      .map(
        (l) =>
          `${l.timestamp} ${l.pid || 0} [${l.level}] ${l.component}: ${l.message}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1100px',
          height: '85vh',
          backgroundColor: '#0f172a',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}
      >
        {/* ─── Header ─── */}
        <div
          style={{
            padding: '16px 24px',
            background: 'linear-gradient(90deg, #1e293b, #0f172a)',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
              }}
            >
              🖥️
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.01em' }}>
                ระบบบันทึก Timestamp Logs (System & Database Diagnostics)
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                ตรวจสอบประวัติการเชื่อมต่อ HOSxP MySQL, เหตุการณ์ Downtime, และ Service Logs ตาม Timestamp แม่นยำ
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '8px',
              transition: 'all 0.15s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#334155';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#94a3b8';
            }}
            title="ปิดหน้าต่าง"
          >
            ✕
          </button>
        </div>

        {/* ─── Quick Health Cards ─── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            padding: '16px 24px',
            background: '#131d33',
            borderBottom: '1px solid #1e293b',
            flexShrink: 0,
          }}
        >
          {/* HOSxP Status */}
          <div
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '10px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
                HOSxP Database
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: dbStatus?.pool_available ? '#22c55e' : '#ef4444',
                    boxShadow: dbStatus?.pool_available
                      ? '0 0 8px #22c55e'
                      : '0 0 8px #ef4444',
                  }}
                />
                <span style={{ color: dbStatus?.pool_available ? '#86efac' : '#fca5a5' }}>
                  {dbStatus?.pool_available ? 'Connected (ปกติ)' : 'Disconnected / Warning'}
                </span>
              </div>
            </div>
            <span style={{ fontSize: '20px' }}>🏥</span>
          </div>

          {/* Total Logs */}
          <div
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '10px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
                Total Timestamp Logs
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px', color: '#38bdf8' }}>
                {summary?.total_logs ?? logs.length} รายการ
              </div>
            </div>
            <span style={{ fontSize: '20px' }}>📋</span>
          </div>

          {/* Error Count */}
          <div
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '10px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
                Error / Crash Events
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  marginTop: '2px',
                  color: (summary?.error_logs || 0) > 0 ? '#f87171' : '#4ade80',
                }}
              >
                {summary?.error_logs ?? 0} เหตุการณ์
              </div>
            </div>
            <span style={{ fontSize: '20px' }}>⚠️</span>
          </div>

          {/* DB File Path */}
          <div
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '10px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
                Log Storage (SQLite WAL)
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#cbd5e1',
                  marginTop: '2px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '180px',
                }}
                title="backend/data/timestamp_logs.db"
              >
                timestamp_logs.db
              </div>
            </div>
            <span style={{ fontSize: '20px' }}>💾</span>
          </div>
        </div>

        {/* ─── Action Controls & Filters ─── */}
        <div
          style={{
            padding: '12px 24px',
            background: '#0f172a',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          {/* Left: Filter tabs & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: '#1e293b', borderRadius: '8px', padding: '3px', border: '1px solid #334155' }}>
              {(['ALL', 'ERROR', 'Warning', 'Note'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setFilterLevel(lvl)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    background: filterLevel === lvl ? '#0284c7' : 'transparent',
                    color: filterLevel === lvl ? '#ffffff' : '#94a3b8',
                    transition: 'all 0.15s',
                  }}
                >
                  {lvl === 'ALL'
                    ? 'ทั้งหมด'
                    : lvl === 'ERROR'
                    ? '🔴 ERROR'
                    : lvl === 'Warning'
                    ? '🟡 Warning'
                    : '🟢 Note'}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="ค้นหาข้อความ, error, component..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  color: '#ffffff',
                  outline: 'none',
                  width: '240px',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                color: '#94a3b8',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                style={{ accentColor: '#0284c7', cursor: 'pointer' }}
              />
              Auto-refresh (4s)
            </label>

            <button
              type="button"
              onClick={fetchLogsData}
              disabled={isLoading}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 600,
                background: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #334155',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{isLoading ? '⏳' : '🔄'}</span> รีเฟรช
            </button>

            <button
              type="button"
              onClick={handleCopyLogs}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 700,
                background: copied ? '#15803d' : '#334155',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s',
              }}
            >
              <span>📋</span> {copied ? 'คัดลอกเรียบร้อย!' : 'คัดลอก Log'}
            </button>
          </div>
        </div>

        {/* ─── Log Stream Console ─── */}
        <div
          style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            background: '#020617',
            fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: '12px',
            lineHeight: 1.6,
          }}
        >
          {logs.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#64748b',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '32px' }}>🔍</span>
              <div>ไม่พบประวัติ Log ตามเงื่อนไขที่เลือก</div>
            </div>
          ) : (
            logs.map((log) => {
              const isErr = log.level.toUpperCase() === 'ERROR' || log.level.toUpperCase() === 'CRITICAL';
              const isWarn = log.level.toUpperCase().includes('WARN');
              const levelColor = isErr ? '#f87171' : isWarn ? '#facc15' : '#38bdf8';
              const levelBg = isErr
                ? 'rgba(239, 68, 68, 0.15)'
                : isWarn
                ? 'rgba(234, 179, 8, 0.15)'
                : 'rgba(56, 189, 248, 0.1)';

              return (
                <div
                  key={log.id}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    marginBottom: '4px',
                    background: isErr ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    borderLeft: `3px solid ${isErr ? '#ef4444' : isWarn ? '#eab308' : '#38bdf8'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Timestamp */}
                    <span style={{ color: '#94a3b8', fontWeight: 600 }}>{log.timestamp}</span>

                    {/* PID */}
                    <span style={{ color: '#64748b' }}>[{log.pid || 0}]</span>

                    {/* Level Badge */}
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 800,
                        color: levelColor,
                        background: levelBg,
                        border: `1px solid ${levelColor}44`,
                      }}
                    >
                      {log.level.toUpperCase()}
                    </span>

                    {/* Component */}
                    <span style={{ color: '#c084fc', fontWeight: 700 }}>{log.component}:</span>

                    {/* Message */}
                    <span
                      style={{
                        color: isErr ? '#fca5a5' : '#e2e8f0',
                        fontWeight: isErr ? 600 : 400,
                        wordBreak: 'break-word',
                      }}
                    >
                      {log.message}
                    </span>
                  </div>

                  {/* Optional JSON details with syntax highlighting & collapse */}
                  {log.details && Object.keys(log.details).length > 0 && (
                    <JsonSyntaxViewer data={log.details} />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ─── Footer with CLI Command Reference ─── */}
        <div
          style={{
            padding: '10px 24px',
            background: '#0a0f1d',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#64748b',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💡</span>
            <span>
              สำหรับ IT / DBA สามารถรันผ่าน Terminal ได้โดยตรงด้วย:{' '}
              <code
                style={{
                  background: '#1e293b',
                  color: '#38bdf8',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                }}
              >
                ./scripts/check_logs.sh --tail 20
              </code>
            </span>
          </div>

          <div>แสดงผลสูงสุด 100 รายการล่าสุด</div>
        </div>
      </div>
    </div>
  );
}
