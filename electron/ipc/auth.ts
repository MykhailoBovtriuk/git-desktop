import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertString } from '../ipc-validators';
import { wrap } from './wrap';

export function registerAuthHandlers(git: GitService) {
  ipcMain.handle('git:get-auth-status', () => wrap(() => git.getAuthStatus()));

  ipcMain.handle('git:set-credential-helper', (_e, value: string) =>
    wrap(() => {
      assertString(value, 'value');
      return git.setCredentialHelper(value);
    }),
  );

  ipcMain.handle('git:get-allowed-helpers', () => ({ data: git.allowedHelpers() }));
}
