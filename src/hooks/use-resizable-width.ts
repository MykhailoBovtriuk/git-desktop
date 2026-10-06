import { useState } from 'react';
import { getLocalStorage } from '../lib/storage';

function loadWidth(storageKey: string, min: number, max: number, initial: number): number {
  const saved = Number(getLocalStorage().getItem(storageKey));
  return saved >= min && saved <= max ? saved : initial;
}

/**
 * A column width dragged with the mouse and remembered in localStorage. `edge`
 * is the side the handle sits on: a panel docked right grows as it moves left.
 */
export function useResizableWidth(
  storageKey: string,
  min: number,
  max: number,
  initial = min,
  edge: 'left' | 'right' = 'right',
) {
  const [width, setWidth] = useState(() => loadWidth(storageKey, min, max, initial));

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const sign = edge === 'left' ? -1 : 1;
    const onMove = (ev: MouseEvent) =>
      setWidth(Math.min(max, Math.max(min, startWidth + sign * (ev.clientX - startX))));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      setWidth(w => {
        getLocalStorage().setItem(storageKey, String(w));
        return w;
      });
    };
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return { width, startResize };
}
