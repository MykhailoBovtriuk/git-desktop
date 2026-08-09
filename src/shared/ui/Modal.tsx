import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from './cn';

export interface ModalProps {
  title: string;
  subtitle?: ReactNode;
  titleVariant?: 'default' | 'danger';
  level?: 'low' | 'high';
  width?: string;
  footer?: ReactNode;
  children: ReactNode;
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;

      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const inPanel = active instanceof Node && panel.contains(active);

      if (e.shiftKey) {
        if (!inPanel || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inPanel || active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div
      className={cn(
        'fixed inset-0 bg-black/50 flex items-center justify-center',
        level === 'high' ? 'z-50' : 'z-40',
      )}
    >
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
        {subtitle && <p className="text-subtext text-sm mb-4">{subtitle}</p>}
        <div className="text-text text-sm">{children}</div>
        {footer && <div className="flex justify-end gap-2 mt-2">{footer}</div>}
      </div>
    </div>
  );
}
