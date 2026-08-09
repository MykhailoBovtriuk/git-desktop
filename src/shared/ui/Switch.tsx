import { cn } from './cn';

export interface SwitchProps {
  checked: boolean;
  onToggle: () => void;
  label?: string;
  title?: string;
  className?: string;
}

export function Switch({ checked, onToggle, label, title, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      onClick={onToggle}
      className={cn(
        'flex items-center gap-1.5 text-xs text-subtext hover:text-text transition-colors',
        className,
      )}
    >
      <span
        className={cn(
          'relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors duration-200',
          checked ? 'bg-blue' : 'bg-surface2',
        )}
      >
        <span
          className={cn(
            'inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-3' : 'translate-x-0.5',
          )}
        />
      </span>
      {label}
    </button>
  );
}
