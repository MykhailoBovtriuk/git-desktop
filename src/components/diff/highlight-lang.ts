import type { ResolvedTheme } from '../../types';

// Catppuccin Mocha/Latte match the app palette in styles/globals.css, so the
// diff never looks like a foreign panel dropped into the window.
const DIFF_THEMES: Record<ResolvedTheme, string> = {
  dark: 'catppuccin-mocha',
  light: 'catppuccin-latte',
};

export function diffTheme(resolved: ResolvedTheme): string {
  return DIFF_THEMES[resolved];
}

const EXT_LANG: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  json: 'json',
  css: 'css',
  scss: 'css',
  html: 'html',
  htm: 'html',
  py: 'python',
  go: 'go',
  rs: 'rust',
  md: 'markdown',
  markdown: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
};

export function langForPath(path: string): string | null {
  const ext = path.split('.').pop()?.toLowerCase();
  return ext ? (EXT_LANG[ext] ?? null) : null;
}
