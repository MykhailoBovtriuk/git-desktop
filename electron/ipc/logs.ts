import { BrowserWindow, ipcMain, shell } from 'electron';
import fs from 'fs/promises';
import { wrap } from './wrap';
import { assertString } from '../ipc-validators';
import { setLogSink } from '../log/git-logger';
import { LogStore, isLogRetention } from '../log/log-store';

export interface LogHandlerOptions {
  getWindow?: () => BrowserWindow | null;
  /** Root of the per-repository log folders; without it the log lives for the session only. */
  logDir?: string;
}

const PRUNE_EVERY_MS = 6 * 60 * 60 * 1000;
const MAX_PAGE = 500;

export function registerLogHandlers(options: LogHandlerOptions = {}): LogStore {
  const store = new LogStore(options.logDir ?? null);
  const ready = store.init();

  // Running entries go to the panel straight away; only settled ones are kept.
  setLogSink(entry => {
    const win = options.getWindow?.() ?? null;
    if (win && !win.isDestroyed()) win.webContents.send('log:entry', entry);
    void ready.then(() => store.append(entry));
  });

  // An app left open for a week still has to forget what the setting says.
  setInterval(() => void store.prune(), PRUNE_EVERY_MS).unref?.();

  ipcMain.handle('log:list', (_e, repoPath: unknown, before: unknown, limit: unknown) =>
    wrap(async () => {
      assertString(repoPath, 'repoPath');
      await ready;
      const from = typeof before === 'number' && Number.isFinite(before) ? before : Infinity;
      const size =
        typeof limit === 'number' && Number.isInteger(limit) && limit > 0
          ? Math.min(limit, MAX_PAGE)
          : 200;
      return store.list(repoPath, from, size);
    }),
  );

  ipcMain.handle('log:stats', (_e, repoPath: unknown) =>
    wrap(async () => {
      assertString(repoPath, 'repoPath');
      await ready;
      return store.stats(repoPath);
    }),
  );

  ipcMain.handle('log:clear', (_e, repoPath: unknown) =>
    wrap(async () => {
      assertString(repoPath, 'repoPath');
      await ready;
      await store.clear(repoPath);
      return null;
    }),
  );

  ipcMain.handle('log:get-retention', () => wrap(() => ready.then(() => store.getRetention())));

  ipcMain.handle('log:set-retention', (_e, retention: unknown) =>
    wrap(async () => {
      if (!isLogRetention(retention)) throw new Error('Invalid argument: retention');
      await ready;
      await store.setRetention(retention);
      return null;
    }),
  );

  ipcMain.handle('log:open-folder', (_e, repoPath: unknown) =>
    wrap(async () => {
      assertString(repoPath, 'repoPath');
      const dir = store.repoDir(repoPath);
      if (!dir) throw new Error('Logs are not stored on disk');
      await fs.mkdir(dir, { recursive: true });
      const failure = await shell.openPath(dir);
      if (failure) throw new Error(failure);
      return null;
    }),
  );

  return store;
}
