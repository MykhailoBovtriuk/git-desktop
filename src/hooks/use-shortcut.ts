import { useEffect, useRef } from 'react';
import { fromTerminal, isMac } from '../lib/keyboard';

interface Shortcut {
  /** Matched case-insensitively against `KeyboardEvent.key`. */
  key?: string;
  /** Matched against `KeyboardEvent.code`, for keys whose `key` varies by layout (Backquote). */
  code?: string;
  /**
   * 'cmd-or-ctrl': Cmd on macOS, Ctrl elsewhere; on Windows/Linux it stands
   * aside inside a terminal, where Ctrl-letters belong to the shell.
   * 'ctrl': Ctrl on every platform (Ctrl+`, as in VS Code), terminal included.
   */
  mod: 'cmd-or-ctrl' | 'ctrl';
}

/** An app-wide keyboard shortcut without Shift or Alt. */
export function useShortcut(shortcut: Shortcut, handler: () => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  const { key, code, mod } = shortcut;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey || e.altKey) return;
      if (key !== undefined && e.key.toLowerCase() !== key.toLowerCase()) return;
      if (code !== undefined && e.code !== code) return;
      const pressed =
        mod === 'ctrl'
          ? e.ctrlKey && !e.metaKey
          : isMac()
            ? e.metaKey
            : e.ctrlKey && !fromTerminal(e);
      if (!pressed) return;
      e.preventDefault();
      handlerRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, code, mod]);
}
