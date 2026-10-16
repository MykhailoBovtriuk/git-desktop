import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertBranchName } from '../ipc-validators';
import { wrap, wrapLogged } from './wrap';

export function registerRebaseHandlers(git: GitService) {
  ipcMain.handle('git:rebase', (_e, branch: string) =>
    wrapLogged('rebase', git, branch, () => {
      assertBranchName(branch, 'branch');
      return git.rebase(branch).then(() => null);
    }),
  );

  ipcMain.handle('git:is-rebasing', () => wrap(() => git.isRebasing()));

  ipcMain.handle('git:abort-rebase', () =>
    wrapLogged('rebase-abort', git, undefined, () => git.abortRebase().then(() => null)),
  );

  ipcMain.handle('git:continue-rebase', () =>
    wrapLogged('rebase-continue', git, undefined, () => git.continueRebase().then(() => null)),
  );
}
