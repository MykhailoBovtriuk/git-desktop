import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { wrap } from './wrap';
import { assertString } from '../ipc-validators';

/**
 * Everything the app is allowed to open, and nothing else.
 *
 * Origins come from the entries themselves and are compared with `URL.origin`,
 * so a lookalike host such as "docs.github.com.evil.com" never matches — its
 * origin belongs to the attacker, not to us.
 */
const EXTERNAL_PREFIXES = [
  'https://github.com/MykhailoBovtriuk/git-desktop',
  'https://github.com/sponsors/MykhailoBovtriuk',
];

const ALLOWED_ORIGINS = new Set(EXTERNAL_PREFIXES.map(p => new URL(p).origin));

export function isAllowedExternalUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (!ALLOWED_ORIGINS.has(url.origin)) return false;
  // Prefix match on the full URL would let "…/git-desktop.evil" through, so the
  // next character has to end the path segment.
  return EXTERNAL_PREFIXES.some(
    prefix =>
      url.href === prefix || url.href.startsWith(prefix + '/') || url.href.startsWith(prefix + '?'),
  );
}

export interface AppHandlerOptions {
  getWindow?: () => BrowserWindow | null;
}

export function registerAppHandlers(options: AppHandlerOptions = {}) {
  ipcMain.handle('app:get-version', () => ({ data: app.getVersion() }));

  ipcMain.handle('shell:open-external', (_e, url: string) =>
    wrap(async () => {
      assertString(url, 'url');
      if (!isAllowedExternalUrl(url)) {
        throw new Error(`Blocked external URL: ${url}`);
      }
      await shell.openExternal(url);
      return null;
    }),
  );

  // Windows/Linux draw the window controls themselves, into a strip whose
  // colours are fixed at construction time — so a theme switch has to push the
  // new colours back into the native overlay or the buttons stay dark.
  ipcMain.handle('window:set-titlebar-overlay', (_e, color: string, symbolColor: string) =>
    wrap(async () => {
      if (process.platform === 'darwin') return null;
      assertString(color, 'color');
      assertString(symbolColor, 'symbolColor');
      const hex = /^#[0-9a-f]{6}$/i;
      if (!hex.test(color) || !hex.test(symbolColor)) {
        throw new Error('Invalid argument: colors must be #rrggbb');
      }
      const win = options.getWindow?.() ?? null;
      win?.setTitleBarOverlay?.({ color, symbolColor, height: 40 });
      return null;
    }),
  );
}
