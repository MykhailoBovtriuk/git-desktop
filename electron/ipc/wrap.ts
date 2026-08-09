export function wrap<T>(fn: () => Promise<T>) {
  return Promise.resolve()
    .then(fn)
    .then(data => ({ data }))
    .catch((err: unknown) => ({
      error: err instanceof Error ? err.message : String(err),
      code: 'GIT_ERROR',
    }));
}
