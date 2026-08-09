// Wrap a handler so every IPC reply is a uniform { data } | { error, code }
// envelope. Exported for unit tests. Validators throw synchronously, so `fn`
// must run inside the promise chain — otherwise the exception escapes the
// envelope.
export function wrap<T>(fn: () => Promise<T>) {
  return Promise.resolve()
    .then(fn)
    .then(data => ({ data }))
    .catch((err: unknown) => ({
      error: err instanceof Error ? err.message : String(err),
      code: 'GIT_ERROR',
    }));
}
