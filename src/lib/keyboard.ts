/**
 * The platform and keyboard rules the app's shortcuts share. Electron reports
 * the platform through preload; without it (tests, a plain browser) macOS is
 * assumed, which is where the app is mostly developed.
 */
export const isMac = (): boolean => (window.electronAPI?.platform ?? 'darwin') === 'darwin';

/** "⌘J" on macOS, "Ctrl+J" elsewhere: how a Cmd-or-Ctrl shortcut is written. */
export const shortcutLabel = (key: string): string => (isMac() ? `⌘${key}` : `Ctrl+${key}`);

/**
 * Whether a key event comes from inside a terminal. Ctrl-letter keys mean
 * something to the shell there (Ctrl+B back a character, Ctrl+J newline), so
 * app shortcuts built on them stand aside.
 */
export function fromTerminal(e: KeyboardEvent): boolean {
  return e.target instanceof Element && e.target.closest('.xterm') !== null;
}
