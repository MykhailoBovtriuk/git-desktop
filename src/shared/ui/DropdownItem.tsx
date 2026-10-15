import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { cn } from './cn';

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

export function DropdownRow({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn(ROW, 'hover:bg-surface1', className)} />;
}
