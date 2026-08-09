import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertBranchName } from '../ipc-validators';
import { wrap } from './wrap';

export function registerRemoteHandlers(git: GitService) {
  ipcMain.handle('git:fetch', () => wrap(() => git.fetch().then(() => null)));

  ipcMain.handle('git:pull', () => wrap(() => git.pull()));

  ipcMain.handle('git:push', () => wrap(() => git.push().then(() => null)));

  ipcMain.handle('git:push-set-upstream', (_e, remote: string, branch: string) =>
    wrap(() => {
      assertBranchName(remote, 'remote');
      assertBranchName(branch, 'branch');
      return git.pushSetUpstream(remote, branch).then(() => null);
    }),
  );
}
