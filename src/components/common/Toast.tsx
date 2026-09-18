export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
}

/** Fire a toast from anywhere (outside React components too) */
// eslint-disable-next-line react-refresh/only-export-components
export function showToast(_message: string, _type: Toast['type'] = 'info', _duration = 3000) {
  // Toast notifications disabled per user request
  return;
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
  // Toast notifications disabled per user request
  return null;
}

export default ToastContainer;
