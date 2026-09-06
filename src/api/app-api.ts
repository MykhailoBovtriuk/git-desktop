import { invoke } from './invoke';

export const appApi = {
  getVersion: () => invoke<string>('app:get-version'),
  openExternal: (url: string) => invoke<null>('shell:open-external', url),
  setTitlebarOverlay: (color: string, symbolColor: string) =>
    invoke<null>('window:set-titlebar-overlay', color, symbolColor),
};
