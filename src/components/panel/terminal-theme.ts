import type { ITheme } from '@xterm/xterm';

/** The app palette, read live so the terminal follows a theme switch. */
export function readTerminalTheme(): ITheme {
  const styles = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) =>
    styles.getPropertyValue(`--gd-${name}`).trim() || fallback;
  const text = v('text', '#cdd6f4');
  return {
    background: v('base', '#1e1e2e'),
    foreground: text,
    cursor: text,
    cursorAccent: v('base', '#1e1e2e'),
    selectionBackground: v('surface2', '#585b70'),
    black: v('surface1', '#45475a'),
    red: v('red', '#f38ba8'),
    green: v('green', '#a6e3a1'),
    yellow: v('yellow', '#f9e2af'),
    blue: v('blue', '#89b4fa'),
    magenta: v('peach', '#fab387'),
    cyan: v('sky', '#89dceb'),
    white: v('subtext', '#bac2de'),
    brightBlack: v('surface2', '#585b70'),
    brightRed: v('red', '#f38ba8'),
    brightGreen: v('green', '#a6e3a1'),
    brightYellow: v('yellow', '#f9e2af'),
    brightBlue: v('blue', '#89b4fa'),
    brightMagenta: v('peach', '#fab387'),
    brightCyan: v('sky', '#89dceb'),
    brightWhite: text,
  };
}
