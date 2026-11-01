import type { IpcResult } from '../types';

export async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await window.electronAPI.invoke(channel, ...args)) as IpcResult<T>;
  if (result && typeof result === 'object' && 'error' in result) {
    throw Object.assign(new Error(result.error), result.logId ? { logId: result.logId } : {});
  }
  return result.data;
}
