// Kept separate from highlighter.ts (which imports the heavy shiki modules) so
// DiffViewer can import langForPath synchronously to decide whether a file is
// worth loading the highlighter for — without pulling shiki into its own chunk.

// Shiki theme matching the app's Catppuccin Mocha palette.
export const DIFF_THEME = 'catppuccin-mocha';

// Extension → bundled shiki language. Only languages we ship a grammar for are
// listed; anything else falls back to plain (unhighlighted) diff text.
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
