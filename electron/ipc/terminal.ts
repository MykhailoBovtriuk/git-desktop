import { BrowserWindow, ipcMain, shell } from 'electron';
import { wrap } from './wrap';
import { assertDimension, assertString } from '../ipc-validators';
import { loadPty } from '../terminal/pty-loader';
import { detectShells, type ShellSpec } from '../terminal/shell';
import { TerminalManager } from '../terminal/terminal-manager';
import type { TerminalAvailability, TerminalShell } from '../../src/types';

export interface TerminalHandlerOptions {
  getWindow?: () => BrowserWindow | null;
}

/** Paste of a large file is fine; a runaway renderer loop is not. */
const MAX_WRITE = 1024 * 1024;

/** The handle the rest of main needs: closing a repository's shells. */
export interface TerminalControl {
  killRepo: (repoPath: string) => void;
  killAll: () => void;
}

export function registerTerminalHandlers(options: TerminalHandlerOptions = {}): TerminalControl {
  let shells: ShellSpec[] | null = null;
  const getShells = () => (shells ??= detectShells());
  let manager: TerminalManager | null = null;

  const send = (channel: string, ...args: unknown[]) => {
    const win = options.getWindow?.() ?? null;
    if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
  };

  // Loading node-pty waits for the first terminal, so a broken binary never
  // touches startup.
  const getManager = (): TerminalManager => {
    if (manager) return manager;
    const { pty, reason } = loadPty();
    if (!pty) throw new Error(reason ?? 'Terminal is not available');
    manager = new TerminalManager(pty, getShells, {
      data: (id, data) => send('term:data', id, data),
      exit: (id, exitCode) => send('term:exit', id, exitCode),
    });
    return manager;
  };

  ipcMain.handle('term:available', () =>
    wrap(async (): Promise<TerminalAvailability> => {
      const { pty, reason } = loadPty();
      if (!pty) return { ok: false, reason };
      return getShells().length > 0 ? { ok: true } : { ok: false, reason: 'No shell found' };
    }),
  );

  ipcMain.handle('term:shells', () =>
    wrap(async (): Promise<TerminalShell[]> => getShells().map(({ id, label }) => ({ id, label }))),
  );

  ipcMain.handle(
    'term:create',
    (_e, repoPath: unknown, shellId: unknown, cols: unknown, rows: unknown) =>
      wrap(async () => {
        assertString(repoPath, 'repoPath');
        if (shellId !== null && shellId !== undefined) assertString(shellId, 'shellId');
        assertDimension(cols, 'cols');
        assertDimension(rows, 'rows');
        return getManager().create({ repoPath, shellId, cols, rows });
      }),
  );

  ipcMain.handle('term:write', (_e, id: unknown, data: unknown) =>
    wrap(async () => {
      assertString(id, 'id');
      if (typeof data !== 'string' || data.length > MAX_WRITE) {
        throw new Error('Invalid argument: data');
      }
      getManager().write(id, data);
      return null;
    }),
  );

  ipcMain.handle('term:resize', (_e, id: unknown, cols: unknown, rows: unknown) =>
    wrap(async () => {
      assertString(id, 'id');
      assertDimension(cols, 'cols');
      assertDimension(rows, 'rows');
      getManager().resize(id, cols, rows);
      return null;
    }),
  );

  ipcMain.handle('term:kill', (_e, id: unknown) =>
    wrap(async () => {
      assertString(id, 'id');
      manager?.kill(id);
      return null;
    }),
  );

  ipcMain.handle('term:list', (_e, repoPath: unknown) =>
    wrap(async () => {
      assertString(repoPath, 'repoPath');
      return manager?.list(repoPath) ?? [];
    }),
  );

  ipcMain.handle('term:buffer', (_e, id: unknown) =>
    wrap(async () => {
      assertString(id, 'id');
      return getManager().buffer(id);
    }),
  );

  // Links printed in a terminal can point anywhere, unlike the app's own
  // allowlisted ones; the renderer asks the user before calling this.
  ipcMain.handle('term:open-link', (_e, url: unknown) =>
    wrap(async () => {
      assertString(url, 'url');
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error('Invalid URL');
      }
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error('Only web links can be opened');
      }
      await shell.openExternal(parsed.href);
      return null;
    }),
  );

  return {
    killRepo: repoPath => manager?.killRepo(repoPath),
    killAll: () => manager?.killAll(),
  };
}
