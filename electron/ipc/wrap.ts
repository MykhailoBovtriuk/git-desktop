import type { BrowserWindow } from 'electron';
import type { IpcResult, LogOp } from '../../src/types';
import { logged, logIdOf, type LoggedOptions } from '../log/git-logger';
import { isRepoPath } from '../ipc-validators';

export const QUIET: LoggedOptions = { quiet: true };

export function wrap<T>(fn: () => T | Promise<T>): Promise<IpcResult<T | null>> {
  return Promise.resolve()
    .then(fn)
    .then(data => ({ data: data ?? null }))
    .catch((err: unknown) => {
      const logId = logIdOf(err);
      return {
        error: err instanceof Error ? err.message : String(err),
        ...(logId ? { logId } : {}),
      };
    });
}

export function detailOf(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const line = value.split('\n', 1)[0].trim();
  return line ? line.slice(0, 200) : undefined;
}

export function wrapLogged<T>(
  op: LogOp,
  repo: { getRepoPath(): string | null },
  detail: unknown,
  fn: () => Promise<T>,
  options?: LoggedOptions,
): Promise<IpcResult<T | null>> {
  return wrap(() => logged(op, repo.getRepoPath(), detailOf(detail), fn, options));
}

export function wrapRead<T>(
  repo: { getRepoPath(): string | null },
  detail: unknown,
  fn: () => Promise<T>,
): Promise<IpcResult<T | null>> {
  return wrapLogged('refresh', repo, detail, fn, QUIET);
}

export function wrapLoggedFor<T>(
  op: LogOp,
  repoPath: unknown,
  detail: unknown,
  fn: () => Promise<T>,
  options?: LoggedOptions,
): Promise<IpcResult<T | null>> {
  // Not yet validated here: anything but a plain absolute path goes to the app log.
  const owner = isRepoPath(repoPath) ? repoPath : null;
  return wrap(() => logged(op, owner, detailOf(detail), fn, options));
}

export interface WindowOptions {
  getWindow?: () => BrowserWindow | null;
}

export function sendToRenderer(options: WindowOptions, channel: string, ...args: unknown[]): void {
  const win = options.getWindow?.();
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
}
