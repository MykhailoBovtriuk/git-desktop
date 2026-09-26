/**
 * The single bridge to the main process: unwraps `{ data }` / `{ error, code }`
 * from `electron/ipc/wrap.ts` in one place.
 */
export async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = await window.electronAPI.invoke(channel, ...args);
  if (result && typeof result === 'object' && 'error' in result) {
    throw new Error((result as { error: string }).error);
  }
  return (result as { data: T }).data;
}
