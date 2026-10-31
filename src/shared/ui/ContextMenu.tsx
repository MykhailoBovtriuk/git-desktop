import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

interface ContextMenuProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  anchor?: 'button' | 'panel' | 'below';
  children: ReactNode;
}

export function ContextMenu({ open, anchorRef, anchor = 'button', children }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !ref.current) {
      setPos(null);
      return;
    }
    const r = anchorRef.current.getBoundingClientRect();
    const { width, height } = ref.current.getBoundingClientRect();

    let left: number;
    let top = r.top;
    if (anchor === 'below') {
      left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      top = r.bottom + 4;
    } else if (anchor === 'panel') {
      const panel =
        anchorRef.current.closest('[data-dropdown-panel]')?.getBoundingClientRect() ?? r;
      left = panel.left - width - 4;
      if (left < 8) left = panel.right + 4;
      if (left + width > window.innerWidth) left = window.innerWidth - width - 8;
    } else {
      left = r.right + 4;
      if (left + width > window.innerWidth) left = r.left - width - 4;
    }

    if (top + height > window.innerHeight) top = window.innerHeight - height - 8;
    setPos({ top, left });
  }, [open, anchor, anchorRef]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      onMouseDown={e => e.stopPropagation()}
      className={cn('fixed bg-surface1 rounded-lg shadow-xl z-60 py-1 w-44', !pos && 'invisible')}
      style={pos ?? { top: 0, left: 0 }}
    >
      {children}
    </div>,
    document.body,
  );
}
