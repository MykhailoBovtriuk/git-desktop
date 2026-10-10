import type { IpcResult, LogOp } from '../../src/types';
import { logged } from '../log/git-logger';

export function wrap<T>(fn: () => Promise<T>): Promise<IpcResult<T>> {
  return Promise.resolve()
    .then(fn)
    .then(data => ({ data }))
    .catch((err: unknown) => ({
      error: err instanceof Error ? err.message : String(err),
      code: 'GIT_ERROR',
    }));
}

/** First line only: a commit body or a stray object has no place in a log title. */
function detailOf(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const line = value.split('\n', 1)[0].trim();
  return line ? line.slice(0, 200) : undefined;
}

/** `wrap` for operations the user starts: the run and its git output go to the log. */
export function wrapLogged<T>(
  op: LogOp,
  repo: { getRepoPath(): string | null },
  detail: unknown,
  fn: () => Promise<T>,
): Promise<IpcResult<T>> {
  return wrap(() => logged(op, repo.getRepoPath(), detailOf(detail), fn));
}
