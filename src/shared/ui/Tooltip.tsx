import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

const GAP = 4;
const EDGE = 8;

export interface TooltipProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  id?: string;
  children: ReactNode;
}

/** Fixed-position hint portal: below the anchor, flipped above when it would overflow. */
export function Tooltip({ open, anchorRef, id, children }: TooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !ref.current) {
      setPos(null);
      return;
    }
    const a = anchorRef.current.getBoundingClientRect();
    const t = ref.current.getBoundingClientRect();

    let top = a.bottom + GAP;
    if (top + t.height > window.innerHeight - EDGE) top = a.top - t.height - GAP;
    const left = Math.max(EDGE, Math.min(a.left, window.innerWidth - t.width - EDGE));
    setPos({ top, left });
  }, [open, anchorRef, children]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className="fixed z-[70] pointer-events-none bg-white text-black text-xs rounded px-2 py-1 shadow-xl max-w-sm break-words"
      // Measured off-screen first so the flip/clamp can use the real size.
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  );
}
