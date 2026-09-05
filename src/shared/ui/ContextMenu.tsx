import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/** Matches w-44, which the menu is styled with below. */
const MENU_W = 176;

export interface ContextMenuProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  /**
   * "panel" opens beside the closest [data-dropdown-panel] instead of the
   * trigger, for right-aligned panels where the menu would cover its own list.
   */
  anchor?: 'button' | 'panel';
  height: number;
  children: ReactNode;
}

/** Fixed-position "⋯" menu portal, shared by the repo and branch dropdowns. */
export function ContextMenu({ open, anchorRef, anchor = 'button', height, children }: ContextMenuProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return;
    }
    const r = anchorRef.current.getBoundingClientRect();

    let left: number;
    if (anchor === 'panel') {
      const panel =
        anchorRef.current.closest('[data-dropdown-panel]')?.getBoundingClientRect() ?? r;
      left = panel.left - MENU_W - 4;
      if (left < 8) left = panel.right + 4;
      if (left + MENU_W > window.innerWidth) left = window.innerWidth - MENU_W - 8;
    } else {
      left = r.right + 4;
      if (left + MENU_W > window.innerWidth) left = r.left - MENU_W - 4;
    }

    let top = r.top;
    if (top + height > window.innerHeight) top = window.innerHeight - height - 8;
    setPos({ top, left });
  }, [open, anchor, height, anchorRef]);

  if (!open || !pos) return null;
  return createPortal(
    <div
      onMouseDown={e => e.stopPropagation()}
      className="fixed bg-surface1 rounded-lg shadow-xl z-[60] py-1 w-44"
      style={{ top: pos.top, left: pos.left }}
    >
      {children}
    </div>,
    document.body,
  );
}
