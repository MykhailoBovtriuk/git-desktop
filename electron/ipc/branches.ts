import { ipcMain } from 'electron';
import { GitContext } from '../git/context';
import * as branches from '../git/branches';
import { assertBranchName, optionalBoolean } from '../ipc-validators';
import { wrap, wrapLogged } from './wrap';

export function registerBranchHandlers(ctx: GitContext) {
  ipcMain.handle('git:get-branches', () => wrap(() => branches.getBranches(ctx)));

  ipcMain.handle('git:create-branch', (_e, name: string) =>
    wrapLogged('branch-create', ctx, name, () => {
      assertBranchName(name, 'name');
      return branches.createBranch(ctx, name);
    }),
  );

  ipcMain.handle('git:checkout', (_e, branch: string) =>
    wrapLogged('checkout', ctx, branch, () => {
      assertBranchName(branch, 'branch');
      return branches.checkout(ctx, branch);
    }),
  );

  ipcMain.handle('git:checkout-force', (_e, branch: string) =>
    wrapLogged('checkout', ctx, branch, () => {
      assertBranchName(branch, 'branch');
      return branches.checkoutForce(ctx, branch);
    }),
  );

  ipcMain.handle('git:delete-branch', (_e, branch: string, force?: boolean) =>
    wrapLogged('branch-delete', ctx, branch, () => {
      assertBranchName(branch, 'branch');
      return branches.deleteBranch(ctx, branch, optionalBoolean(force, 'force'));
    }),
  );

  ipcMain.handle('git:delete-remote-branch', (_e, remote: string, branch: string) =>
    wrapLogged('remote-branch-delete', ctx, branch, () => {
      assertBranchName(remote, 'remote');
      assertBranchName(branch, 'branch');
      return branches.deleteRemoteBranch(ctx, remote, branch);
    }),
  );
}
