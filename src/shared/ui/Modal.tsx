import type { ReactNode } from 'react';
import { cn } from './cn';

export interface ModalProps {
  title: string;
  subtitle?: ReactNode;
  titleVariant?: 'default' | 'danger';
  level?: 'low' | 'high'; // z-40 (low) or z-50 (high)
  width?: string;         // tailwind width class, default 'w-96'
  footer?: ReactNode;
  children: ReactNode;
}

export function Modal({
  title,
  subtitle,
  titleVariant = 'default',
  level = 'high',
  width = 'w-96',
  footer,
  children,
}: ModalProps) {
  return (
    <div className={cn(
      'fixed inset-0 bg-black/50 flex items-center justify-center',
      level === 'high' ? 'z-50' : 'z-40',
    )}>
      <div className={cn('bg-surface0 rounded-xl p-6 shadow-xl', width)}>
        <h2 className={cn(
          'text-lg font-semibold mb-1',
          titleVariant === 'danger' ? 'text-red' : 'text-text',
        )}>
          {title}
        </h2>
        {subtitle && (
          <p className="text-subtext text-sm mb-4">{subtitle}</p>
        )}
        <div className="text-text text-sm">{children}</div>
        {footer && <div className="flex justify-end gap-2 mt-2">{footer}</div>}
      </div>
    </div>
  );
}
