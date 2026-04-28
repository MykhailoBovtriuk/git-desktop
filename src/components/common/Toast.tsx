import { useEffect } from 'react';
import { useUiStore } from '../../stores/ui-store';
import type { Toast as ToastType } from '../../types';

function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useUiStore(s => s.removeToast);

  useEffect(() => {
    const id = setTimeout(() => removeToast(toast.id), 5000);
    return () => clearTimeout(id);
  }, [toast.id, removeToast]);

  const borderColor =
    toast.variant === 'success' ? 'border-green' :
    toast.variant === 'error' ? 'border-red' : 'border-blue';

  return (
    <div className={`bg-surface0 rounded-lg p-3 flex gap-2 border-l-4 ${borderColor} shadow-lg min-w-64 max-w-80`}>
      <div className="flex-1 min-w-0">
        <p className="text-text text-sm font-medium">{toast.title}</p>
        <p className="text-subtext text-xs mt-0.5">{toast.message}</p>
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="text-blue text-xs underline mt-1"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-subtext hover:text-text text-sm shrink-0"
      >
        ×
      </button>
    </div>
  );
}

export function Toast() {
  const toasts = useUiStore(s => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => <ToastItem key={t.id} toast={t} />)}
    </div>
  );
}
