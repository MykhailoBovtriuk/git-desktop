/**
 * The single bridge between the renderer and the main process.
 *
 * Handlers answer with `{ data }` or `{ error, code }` (see `electron/ipc/wrap.ts`),
 * so unwrapping belongs in one place: every api module would otherwise repeat the
 * same six lines and could drift apart on how an error is surfaced.
 */
export async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = await window.electronAPI.invoke(channel, ...args);
  if (result && typeof result === 'object' && 'error' in result) {
    throw new Error((result as { error: string }).error);
  }
  return (result as { data: T }).data;
}
