import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { cn } from './cn';

// Inset and rounded: the panel keeps a p-2 frame, so the hover reads as a pill
// rather than a stripe running into the panel's edges.
const ROW =
  'flex items-center justify-between w-full px-2 py-1.5 rounded text-sm transition-colors';

export interface DropdownItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'default' | 'accent';
}

export function DropdownItem({ tone = 'default', className, ...rest }: DropdownItemProps) {
  return (
    <button
      {...rest}
      className={cn(
        ROW,
        'text-left enabled:hover:bg-surface1 disabled:opacity-40',
        tone === 'accent' ? 'text-blue' : 'text-text',
        className,
      )}
    />
  );
}

/** Same row for items that hold their own buttons (open + "⋯"). */
export function DropdownRow({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn(ROW, 'hover:bg-surface1', className)} />;
}
