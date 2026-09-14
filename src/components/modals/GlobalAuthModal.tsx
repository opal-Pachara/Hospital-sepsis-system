import { useRTSASStore } from '../../store/useRTSASStore';
import AuthModal from './AuthModal';

export default function GlobalAuthModal() {
  const { ui, closeModal } = useRTSASStore();
  const isOpen = ui.modal.activeModal === 'auth';
  const data = ui.modal.modalData as { defaultMode?: 'login' | 'register' } | null;

  if (!isOpen) return null;

  return (
    <AuthModal
      isOpen={isOpen}
      onClose={closeModal}
      defaultMode={data?.defaultMode || 'login'}
    />
  );
}
