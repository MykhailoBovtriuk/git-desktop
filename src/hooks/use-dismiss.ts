import { useEffect, useRef, type RefObject } from 'react';

/**
 * Closes a popup on a click outside `ref` or on Esc, while `open`.
 *
 * The click listener bubbles, so a portalled menu that stops its own mousedown
 * (ContextMenu) keeps its items clickable. Esc listens in the capture phase and
 * claims the key, so a page that also closes on Esc (Settings) stays open.
 */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      closeRef.current();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, ref]);
}
