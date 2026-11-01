import { ipcMain, shell } from 'electron';
import fs from 'fs/promises';
import { detailOf, wrap, sendToRenderer, type WindowOptions } from './wrap';
import { assertRepoPath } from '../ipc-validators';
import { logEvent, setLogSink } from '../log/git-logger';
import { LogStore, isLogRetention } from '../log/log-store';
import { REPORTABLE_OPS, type ReportableOp } from '../../src/types';

export interface LogHandlerOptions extends WindowOptions {
  logDir?: string;
  getRepoPath?: () => string | null;
}

const PRUNE_EVERY_MS = 6 * 60 * 60 * 1000;
const MAX_PAGE = 500;
const MAX_REPORT_MESSAGE = 2000;
const MAX_REPORT_STACK = 8000;

/** `null` is the app's own log, which the welcome screen shows before any repository is open. */
function assertLogOwner(value: unknown): asserts value is string | null {
  if (value !== null) assertRepoPath(value);
}

function isReportableOp(value: unknown): value is ReportableOp {
  return typeof value === 'string' && (REPORTABLE_OPS as readonly string[]).includes(value);
}

export function registerLogHandlers(options: LogHandlerOptions = {}): LogStore {
  const store = new LogStore(options.logDir ?? null);
  const ready = store.init().catch(() => {});

  setLogSink(entry => {
    sendToRenderer(options, 'log:entry', entry);
    void ready.then(() => store.append(entry));
  });

  setInterval(() => void store.prune(), PRUNE_EVERY_MS).unref?.();

  ipcMain.handle('log:list', (_e, repoPath: unknown, before: unknown, limit: unknown) =>
    wrap(async () => {
      assertLogOwner(repoPath);
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
      assertLogOwner(repoPath);
      await ready;
      return store.stats(repoPath);
    }),
  );

  ipcMain.handle('log:clear', (_e, repoPath: unknown) =>
    wrap(async () => {
      assertLogOwner(repoPath);
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
      assertLogOwner(repoPath);
      const dir = store.repoDir(repoPath);
      if (!dir) throw new Error('Logs are not stored on disk');
      await fs.mkdir(dir, { recursive: true });
      const failure = await shell.openPath(dir);
      if (failure) throw new Error(failure);
    }),
  );

  // The renderer names what failed; which repository it was open on is main's to say.
  ipcMain.handle('log:report', (_e, op: unknown, message: unknown, stack: unknown) =>
    wrap(async () => {
      if (!isReportableOp(op)) throw new Error('Invalid argument: op');
      if (typeof message !== 'string') throw new Error('Invalid argument: message');
      const text = message.slice(0, MAX_REPORT_MESSAGE);
      const trace = typeof stack === 'string' ? stack.slice(0, MAX_REPORT_STACK) : '';
      return logEvent({
        op,
        repoPath: options.getRepoPath?.() ?? null,
        status: 'error',
        detail: detailOf(text),
        error: trace ? `${text}\n${trace}` : text,
      });
    }),
  );

  return store;
}
