export const isMac = (): boolean => (window.electronAPI?.platform ?? 'darwin') === 'darwin';

export const shortcutLabel = (key: string): string => (isMac() ? `⌘${key}` : `Ctrl+${key}`);

/**
 * Whether a key event comes from inside a terminal. Ctrl-letter keys mean
 * something to the shell there (Ctrl+B back a character, Ctrl+J newline), so
 * app shortcuts built on them stand aside.
 */
export function fromTerminal(e: KeyboardEvent): boolean {
  return e.target instanceof Element && e.target.closest('.xterm') !== null;
}
