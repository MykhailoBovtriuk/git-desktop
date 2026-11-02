import { ipcMain, dialog } from 'electron';
import { GitContext } from '../git/context';
import * as history from '../git/history';
import * as remote from '../git/remote';
import * as status from '../git/status';
import { resolveRemote } from '../auth/remote-host';
import { stripLegacyProfileKeys } from '../auth/legacy-cleanup';
import { getIdentity, hasIdentity, setIdentity } from '../auth/identity-bootstrap';
import {
  assertString,
  assertBoundedLogLimit,
  assertNonNegativeInteger,
  assertIdentity,
} from '../ipc-validators';
import { wrap, wrapLogged, wrapLoggedFor, wrapRead, QUIET } from './wrap';
import { markCurrent } from '../log/git-logger';
import { errorMessage } from '../../src/lib/error-message';

export interface RepoHandlerOptions {
  onRepoOpened?: (root: string) => void;
}

export function registerRepoHandlers(ctx: GitContext, options: RepoHandlerOptions = {}) {
  // Logged to the app log: until it succeeds there is no repository to log to.
  ipcMain.handle('git:open-repo', (_e, dirPath: string) =>
    wrapLoggedFor(
      'open-repo',
      null,
      dirPath,
      async () => {
        assertString(dirPath, 'dirPath');
        const root = await ctx.openRepo(dirPath);
        options.onRepoOpened?.(root);
        await stripLegacyProfileKeys(root);
        const remoteUrl = await remote.getRemoteUrl(ctx).catch((err: unknown) => {
          markCurrent({
            status: 'warning',
            error: `Could not read the remote: ${errorMessage(err)}`,
          });
          return null;
        });
        const { url, host, protocol } = await resolveRemote(remoteUrl);
        return { root, remoteUrl: url, remoteHost: host, remoteProtocol: protocol };
      },
      QUIET,
    ),
  );

  ipcMain.handle('git:open-dialog', () =>
    wrap(async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Open Repository',
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    }),
  );

  ipcMain.handle('git:get-log', (_e, limit: number, offset: number) =>
    wrapRead(ctx, 'history', async () => {
      assertBoundedLogLimit(limit);
      assertNonNegativeInteger(offset, 'offset');
      return history.getLog(ctx, limit, offset);
    }),
  );

  ipcMain.handle('git:get-status', () => wrapRead(ctx, 'status', () => status.getStatus(ctx)));

  ipcMain.handle('git:get-head-commit', () =>
    wrapRead(ctx, 'HEAD', () => history.getHeadCommit(ctx)),
  );

  ipcMain.handle('git:get-identity', () =>
    wrapRead(ctx, 'identity', () => getIdentity(ctx.getRepoPath())),
  );

  ipcMain.handle('git:set-identity', (_e, scope: unknown, identity: unknown) =>
    wrapLogged('identity-set', ctx, scope, async () => {
      if (scope !== 'global' && scope !== 'local') throw new Error('Invalid argument: scope');
      assertIdentity(identity);
      await setIdentity(scope, ctx.getRepoPath(), identity);
    }),
  );

  ipcMain.handle('git:has-identity', () =>
    wrapRead(ctx, 'identity', async () => {
      const root = ctx.getRepoPath();
      return root ? hasIdentity(root) : true;
    }),
  );
}
