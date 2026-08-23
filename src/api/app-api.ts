async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = await window.electronAPI.invoke(channel, ...args);
  if (result && typeof result === 'object' && 'error' in result) {
    throw new Error((result as { error: string }).error);
  }
  return (result as { data: T }).data;
}

export const appApi = {
  getVersion: () => invoke<string>('app:get-version'),
  openExternal: (url: string) => invoke<null>('shell:open-external', url),
  setTitlebarOverlay: (color: string, symbolColor: string) =>
    invoke<null>('window:set-titlebar-overlay', color, symbolColor),
};
