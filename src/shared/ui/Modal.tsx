import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from './cn';

export interface ModalProps {
  title: string;
  subtitle?: ReactNode;
  titleVariant?: 'default' | 'danger';
  level?: 'low' | 'high'; // z-40 (low) or z-50 (high)
  width?: string;         // tailwind width class, default 'w-96'
  footer?: ReactNode;
  children: ReactNode;
  // When provided, pressing Escape invokes it. Optional so display-only modals
  // (no dismiss affordance) can omit it.
  onClose?: () => void;
}

export function Modal({
  title,
  subtitle,
  titleVariant = 'default',
  level = 'high',
  width = 'w-96',
  footer,
  children,
  onClose,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog on mount and restore it to the previously
  // focused element on unmount, so keyboard users aren't dropped back at the
  // top of the document.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  useEffect(() => {
    if (!onClose) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className={cn(
      'fixed inset-0 bg-black/50 flex items-center justify-center',
      level === 'high' ? 'z-50' : 'z-40',
    )}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn('bg-surface0 rounded-xl p-6 shadow-xl outline-none', width)}
      >
        <h2
          id={titleId}
          className={cn(
            'text-lg font-semibold mb-1',
            titleVariant === 'danger' ? 'text-red' : 'text-text',
          )}
        >
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
