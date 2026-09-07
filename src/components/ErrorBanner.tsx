import { useRTSASStore } from '../store/useRTSASStore';

interface ErrorBannerProps {
  fetchPatients: () => Promise<void>;
}

export default function ErrorBanner({ fetchPatients }: ErrorBannerProps) {
  const { ui, setLoading, setConnectionStatus } = useRTSASStore();

  if (ui.connectionStatus !== 'disconnected') return null;

  const handleRetry = async () => {
    setLoading(true);
    setConnectionStatus('reconnecting');
    await fetchPatients();
  };

  return (
    <div className="bg-[#ef4444] text-white px-4 py-2 flex items-center justify-between text-sm font-medium z-[150] shadow-md fixed bottom-0 left-0 right-0">
      <div className="flex items-center gap-2">
        <span className="text-lg">⚠️</span>
        <span>ขาดการเชื่อมต่อ HIS (ระบบไม่สามารถดึงข้อมูลผู้ป่วยใหม่ได้) - กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือติดต่อไอที</span>
      </div>
      <button 
        onClick={handleRetry}
        className="bg-white text-[#ef4444] px-4 py-1.5 rounded-md text-xs font-bold hover:bg-red-50 transition-colors cursor-pointer border-none"
      >
        ลองใหม่ (Retry)
      </button>
    </div>
  );
}
