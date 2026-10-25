import { ipcMain, shell } from 'electron';
import fs from 'fs/promises';
import { wrap, sendToRenderer, type WindowOptions } from './wrap';
import { assertRepoPath } from '../ipc-validators';
import { setLogSink } from '../log/git-logger';
import { LogStore, isLogRetention } from '../log/log-store';

export interface LogHandlerOptions extends WindowOptions {
  logDir?: string;
}

const PRUNE_EVERY_MS = 6 * 60 * 60 * 1000;
const MAX_PAGE = 500;

export function registerLogHandlers(options: LogHandlerOptions = {}): LogStore {
  const store = new LogStore(options.logDir ?? null);
  const ready = store.init();

  setLogSink(entry => {
    sendToRenderer(options, 'log:entry', entry);
    void ready.then(() => store.append(entry));
  });

  setInterval(() => void store.prune(), PRUNE_EVERY_MS).unref?.();

  ipcMain.handle('log:list', (_e, repoPath: unknown, before: unknown, limit: unknown) =>
    wrap(async () => {
      assertRepoPath(repoPath);
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
      assertRepoPath(repoPath);
      await ready;
      return store.stats(repoPath);
    }),
  );

  ipcMain.handle('log:clear', (_e, repoPath: unknown) =>
    wrap(async () => {
      assertRepoPath(repoPath);
      await ready;
      await store.clear(repoPath);
    }),
  );

  ipcMain.handle('log:get-retention', () => wrap(() => ready.then(() => store.getRetention())));

  ipcMain.handle('log:set-retention', (_e, retention: unknown) =>
    wrap(async () => {
      if (!isLogRetention(retention)) throw new Error('Invalid argument: retention');
      await ready;
      await store.setRetention(retention);
    }),
  );

  ipcMain.handle('log:open-folder', (_e, repoPath: unknown) =>
    wrap(async () => {
      assertRepoPath(repoPath);
      const dir = store.repoDir(repoPath);
      if (!dir) throw new Error('Logs are not stored on disk');
      await fs.mkdir(dir, { recursive: true });
      const failure = await shell.openPath(dir);
      if (failure) throw new Error(failure);
    }),
  );

  return store;
}
