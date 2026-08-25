import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertString } from '../ipc-validators';
import { wrap } from './wrap';

export function registerIdentityHandlers(git: GitService) {
  ipcMain.handle('git:get-identity', () => wrap(() => git.getEffectiveIdentity()));

  ipcMain.handle('git:set-identity', (_e, name: string, email: string) =>
    wrap(() => {
      assertString(name, 'name');
      assertString(email, 'email');
      return git.setLocalIdentity(name, email);
    }),
  );

  ipcMain.handle('git:set-global-identity', (_e, name: string, email: string) =>
    wrap(() => {
      assertString(name, 'name');
      assertString(email, 'email');
      return git.setGlobalIdentity(name, email);
    }),
  );

  ipcMain.handle('git:clear-identity', () => wrap(() => git.clearLocalIdentity()));
}
