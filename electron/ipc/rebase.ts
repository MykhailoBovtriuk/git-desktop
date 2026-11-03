import { ipcMain } from 'electron';
import { GitContext } from '../git/context';
import * as rebase from '../git/rebase';
import { assertBranchName } from '../ipc-validators';
import { wrapLogged, wrapRead } from './wrap';

export function registerRebaseHandlers(ctx: GitContext) {
  ipcMain.handle('git:rebase', (_e, branch: string) =>
    wrapLogged('rebase', ctx, branch, () => {
      assertBranchName(branch, 'branch');
      return rebase.rebase(ctx, branch);
    }),
  );

  ipcMain.handle('git:is-rebasing', () =>
    wrapRead(ctx, 'rebase state', () => rebase.isRebasing(ctx)),
  );

  ipcMain.handle('git:abort-rebase', () =>
    wrapLogged('rebase-abort', ctx, undefined, () => rebase.abortRebase(ctx)),
  );

  ipcMain.handle('git:continue-rebase', () =>
    wrapLogged('rebase-continue', ctx, undefined, () => rebase.continueRebase(ctx)),
  );
}
