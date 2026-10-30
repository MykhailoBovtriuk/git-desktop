import { ipcMain } from 'electron';
import { GitContext } from '../git/context';
import * as remoteGit from '../git/remote';
import { assertBranchName } from '../ipc-validators';
import { wrapLogged } from './wrap';

export function registerRemoteHandlers(ctx: GitContext) {
  ipcMain.handle('git:fetch', () =>
    wrapLogged('fetch', ctx, undefined, () => remoteGit.fetch(ctx)),
  );

  ipcMain.handle('git:pull', () => wrapLogged('pull', ctx, undefined, () => remoteGit.pull(ctx)));

  ipcMain.handle('git:push', () => wrapLogged('push', ctx, undefined, () => remoteGit.push(ctx)));

  ipcMain.handle('git:switch-remote-protocol', (_e, to: unknown) =>
    wrapLogged('remote-protocol', ctx, to, () => {
      if (to !== 'ssh' && to !== 'https') throw new Error('Invalid protocol');
      return remoteGit.switchRemoteProtocol(ctx, to);
    }),
  );

  ipcMain.handle('git:push-set-upstream', (_e, remote: string, branch: string) =>
    wrapLogged('publish', ctx, branch, () => {
      assertBranchName(remote, 'remote');
      assertBranchName(branch, 'branch');
      return remoteGit.pushSetUpstream(ctx, remote, branch);
    }),
  );
}
