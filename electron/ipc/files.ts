import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertString } from '../ipc-validators';
import { wrap } from './wrap';

export function registerFileHandlers(git: GitService) {
  ipcMain.handle('git:read-file', (_e, p: string) =>
    wrap(() => {
      assertString(p, 'path');
      return git.readFile(p);
    }),
  );

  ipcMain.handle('git:write-file', (_e, p: string, c: string) =>
    wrap(() => {
      assertString(p, 'path');
      if (typeof c !== 'string') throw new Error('Invalid argument: content must be a string');
      return git.writeFile(p, c).then(() => null);
    }),
  );
}
