import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertBranchName } from '../ipc-validators';
import { wrap } from './wrap';

export function registerBranchHandlers(git: GitService) {
  ipcMain.handle('git:get-branches', () => wrap(() => git.getBranches()));

  ipcMain.handle('git:checkout', (_e, branch: string) =>
    wrap(() => {
      assertBranchName(branch, 'branch');
      return git.checkout(branch).then(() => null);
    }),
  );

  ipcMain.handle('git:checkout-force', (_e, branch: string) =>
    wrap(() => {
      assertBranchName(branch, 'branch');
      return git.checkoutForce(branch).then(() => null);
    }),
  );

  ipcMain.handle('git:delete-branch', (_e, branch: string, force?: boolean) =>
    wrap(() => {
      assertBranchName(branch, 'branch');
      if (force !== undefined && typeof force !== 'boolean') {
        throw new Error('Invalid argument: force must be a boolean');
      }
      return git.deleteBranch(branch, force ?? false).then(() => null);
    }),
  );

  ipcMain.handle('git:delete-remote-branch', (_e, remote: string, branch: string) =>
    wrap(() => {
      assertBranchName(remote, 'remote');
      assertBranchName(branch, 'branch');
      return git.deleteRemoteBranch(remote, branch).then(() => null);
    }),
  );
}
