import { useEffect } from 'react';
import { useUiStore } from '../../stores/ui-store';
import { ToastCard } from '../../shared/ui';
import type { Toast as ToastType } from '../../types';

function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useUiStore(s => s.removeToast);
  useEffect(() => {
    const id = setTimeout(() => removeToast(toast.id), 5000);
    return () => clearTimeout(id);
  }, [toast.id, removeToast]);

  return (
    <ToastCard
      variant={toast.variant}
      title={toast.title}
      message={toast.message}
      action={toast.action}
      onDismiss={() => removeToast(toast.id)}
    />
  );
}

export function Toast() {
  const toasts = useUiStore(s => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-12 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => <ToastItem key={t.id} toast={t} />)}
    </div>
  );
}
