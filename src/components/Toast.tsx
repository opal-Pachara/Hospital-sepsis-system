import { useState, useEffect, useCallback } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
}

let toastListeners: Array<(toast: Toast) => void> = [];
let toastIdCounter = 0;

/** Fire a toast from anywhere (outside React components too) */
export function showToast(message: string, type: Toast['type'] = 'info', duration = 3000) {
  const toast: Toast = {
    id: `toast-${++toastIdCounter}`,
    message,
    type,
    duration,
  };
  toastListeners.forEach((listener) => listener(toast));
}

const typeStyles: Record<Toast['type'], { bg: string; icon: string; border: string }> = {
  success: {
    bg: 'bg-green-500/15',
    border: 'border-green-500/30',
    icon: '✓',
  },
  info: {
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    icon: 'ℹ',
  },
  warning: {
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    icon: '⚠',
  },
  error: {
    bg: 'bg-red-500/15',
    border: 'border-red-500/30',
    icon: '✕',
  },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Toast) => {
    setToasts((prev) => [...prev, toast]);

    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, toast.duration);
    }
  }, []);

  useEffect(() => {
    toastListeners.push(addToast);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== addToast);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const style = typeStyles[toast.type];
        return (
          <div
            key={toast.id}
            className={`${style.bg} border ${style.border} rounded-lg px-5 py-4 shadow-lg animate-slide-in flex items-center gap-4`}
          >
            <span className="text-xl flex-shrink-0">{style.icon}</span>
            <p className="text-base text-text-primary flex-1">{toast.message}</p>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
