import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export interface MenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'default' | 'danger';
}

export function MenuItem({ tone = 'default', className, ...rest }: MenuItemProps) {
  return (
    <button
      {...rest}
      className={cn(
        'block w-full text-left px-3 py-1.5 text-xs cursor-pointer transition-colors hover:bg-surface1',
        tone === 'danger' ? 'text-red' : 'text-text',
        className,
      )}
    />
  );
}
