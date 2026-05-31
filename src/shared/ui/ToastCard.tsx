import { cn } from './cn';

type Variant = 'success' | 'error' | 'info';

export interface ToastCardProps {
  variant: Variant;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
  onDismiss: () => void;
}

const BORDER: Record<Variant, string> = {
  success: 'border-green',
  error:   'border-red',
  info:    'border-blue',
};

export function ToastCard({ variant, title, message, action, onDismiss }: ToastCardProps) {
  return (
    <div className={cn(
      'bg-surface0 rounded-lg p-3 flex gap-2 border-l-4 shadow-lg min-w-64 max-w-80',
      BORDER[variant],
    )}>
      <div className="flex-1 min-w-0">
        <p className="text-text text-sm font-medium">{title}</p>
        <p className="text-subtext text-xs mt-0.5">{message}</p>
        {action && (
          <button onClick={action.onClick} className="text-blue text-xs underline mt-1">
            {action.label}
          </button>
        )}
      </div>
      <button onClick={onDismiss} className="text-subtext hover:text-text text-sm shrink-0">
        ×
      </button>
    </div>
  );
}
