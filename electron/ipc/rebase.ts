import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertBranchName } from '../ipc-validators';
import { wrap } from './wrap';

export function registerRebaseHandlers(git: GitService) {
  ipcMain.handle('git:rebase', (_e, branch: string) =>
    wrap(() => {
      assertBranchName(branch, 'branch');
      return git.rebase(branch).then(() => null);
    }),
  );

  ipcMain.handle('git:is-rebasing', () => wrap(() => git.isRebasing()));

  ipcMain.handle('git:abort-rebase', () => wrap(() => git.abortRebase().then(() => null)));

  ipcMain.handle('git:continue-rebase', () => wrap(() => git.continueRebase().then(() => null)));
}
