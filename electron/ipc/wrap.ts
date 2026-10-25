import type { BrowserWindow } from 'electron';
import type { IpcResult, LogOp } from '../../src/types';
import { logged } from '../log/git-logger';

export function wrap<T>(fn: () => T | Promise<T>): Promise<IpcResult<T | null>> {
  return Promise.resolve()
    .then(fn)
    .then(data => ({ data: data ?? null }))
    .catch((err: unknown) => ({ error: err instanceof Error ? err.message : String(err) }));
}

function detailOf(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const line = value.split('\n', 1)[0].trim();
  return line ? line.slice(0, 200) : undefined;
}

export function wrapLogged<T>(
  op: LogOp,
  repo: { getRepoPath(): string | null },
  detail: unknown,
  fn: () => Promise<T>,
): Promise<IpcResult<T | null>> {
  return wrap(() => logged(op, repo.getRepoPath(), detailOf(detail), fn));
}

export interface WindowOptions {
  getWindow?: () => BrowserWindow | null;
}

export function sendToRenderer(options: WindowOptions, channel: string, ...args: unknown[]): void {
  const win = options.getWindow?.();
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
}
