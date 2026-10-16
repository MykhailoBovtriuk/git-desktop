import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertBranchName, optionalBoolean } from '../ipc-validators';
import { wrap, wrapLogged } from './wrap';

export function registerBranchHandlers(git: GitService) {
  ipcMain.handle('git:get-branches', () => wrap(() => git.getBranches()));

  ipcMain.handle('git:create-branch', (_e, name: string) =>
    wrapLogged('branch-create', git, name, () => {
      assertBranchName(name, 'name');
      return git.createBranch(name).then(() => null);
    }),
  );

  ipcMain.handle('git:checkout', (_e, branch: string) =>
    wrapLogged('checkout', git, branch, () => {
      assertBranchName(branch, 'branch');
      return git.checkout(branch).then(() => null);
    }),
  );

  ipcMain.handle('git:checkout-force', (_e, branch: string) =>
    wrapLogged('checkout', git, branch, () => {
      assertBranchName(branch, 'branch');
      return git.checkoutForce(branch).then(() => null);
    }),
  );

  ipcMain.handle('git:delete-branch', (_e, branch: string, force?: boolean) =>
    wrapLogged('branch-delete', git, branch, () => {
      assertBranchName(branch, 'branch');
      return git.deleteBranch(branch, optionalBoolean(force, 'force')).then(() => null);
    }),
  );

  ipcMain.handle('git:delete-remote-branch', (_e, remote: string, branch: string) =>
    wrapLogged('remote-branch-delete', git, branch, () => {
      assertBranchName(remote, 'remote');
      assertBranchName(branch, 'branch');
      return git.deleteRemoteBranch(remote, branch).then(() => null);
    }),
  );
}
