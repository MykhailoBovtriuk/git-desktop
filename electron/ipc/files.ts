import { ipcMain } from 'electron';
import { GitContext } from '../git/context';
import * as files from '../git/files';
import { assertString } from '../ipc-validators';
import { wrapLogged, QUIET } from './wrap';

export function registerFileHandlers(ctx: GitContext) {
  ipcMain.handle('git:read-file', (_e, p: string) =>
    wrapLogged(
      'read-file',
      ctx,
      p,
      async () => {
        assertString(p, 'path');
        return files.readFile(ctx, p);
      },
      QUIET,
    ),
  );

  ipcMain.handle('git:write-file', (_e, p: string, c: string) =>
    wrapLogged('write-file', ctx, p, async () => {
      assertString(p, 'path');
      if (typeof c !== 'string') throw new Error('Invalid argument: content must be a string');
      return files.writeFile(ctx, p, c);
    }),
  );
}
