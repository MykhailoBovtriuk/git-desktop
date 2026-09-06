import { cn } from './cn';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string | number> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  label?: string;
  className?: string;
}

export function SegmentedControl<T extends string | number>({
  value,
  options,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex items-center gap-0.5 bg-mantle rounded p-0.5', className)}
    >
      {options.map(option => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'px-3 py-1 text-xs rounded transition-colors',
              selected ? 'bg-surface1 text-text' : 'text-subtext hover:bg-surface0 hover:text-text',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
