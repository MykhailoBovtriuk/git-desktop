import type { ITheme } from '@xterm/xterm';

export function readTerminalTheme(): ITheme {
  const styles = getComputedStyle(document.documentElement);
  const v = (name: string) => styles.getPropertyValue(`--gd-${name}`).trim();
  const text = v('text');
  return {
    background: v('base'),
    foreground: text,
    cursor: text,
    cursorAccent: v('base'),
    selectionBackground: v('surface2'),
    black: v('surface1'),
    red: v('red'),
    green: v('green'),
    yellow: v('yellow'),
    blue: v('blue'),
    magenta: v('peach'),
    cyan: v('sky'),
    white: v('subtext'),
    brightBlack: v('surface2'),
    brightRed: v('red'),
    brightGreen: v('green'),
    brightYellow: v('yellow'),
    brightBlue: v('blue'),
    brightMagenta: v('peach'),
    brightCyan: v('sky'),
    brightWhite: text,
  };
}
