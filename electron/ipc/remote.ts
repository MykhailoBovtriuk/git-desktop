import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertBranchName } from '../ipc-validators';
import { wrapLogged } from './wrap';

export function registerRemoteHandlers(git: GitService) {
  ipcMain.handle('git:fetch', () =>
    wrapLogged('fetch', git, undefined, () => git.fetch().then(() => null)),
  );

  ipcMain.handle('git:pull', () => wrapLogged('pull', git, undefined, () => git.pull()));

  ipcMain.handle('git:push', () =>
    wrapLogged('push', git, undefined, () => git.push().then(() => null)),
  );

  ipcMain.handle('git:switch-remote-protocol', (_e, to: unknown) =>
    wrapLogged('remote-protocol', git, to, () => {
      if (to !== 'ssh' && to !== 'https') throw new Error('Invalid protocol');
      return git.switchRemoteProtocol(to);
    }),
  );

  ipcMain.handle('git:push-set-upstream', (_e, remote: string, branch: string) =>
    wrapLogged('publish', git, branch, () => {
      assertBranchName(remote, 'remote');
      assertBranchName(branch, 'branch');
      return git.pushSetUpstream(remote, branch).then(() => null);
    }),
  );
}
