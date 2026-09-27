import type { IpcResult } from '../../src/types';

export function wrap<T>(fn: () => Promise<T>): Promise<IpcResult<T>> {
  return Promise.resolve()
    .then(fn)
    .then(data => ({ data }))
    .catch((err: unknown) => ({
      error: err instanceof Error ? err.message : String(err),
      code: 'GIT_ERROR',
    }));
}
