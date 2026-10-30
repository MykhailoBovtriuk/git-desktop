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
import { wrap } from './wrap';

export interface RepoHandlerOptions {
  onRepoOpened?: (root: string) => void;
}

export function registerRepoHandlers(ctx: GitContext, options: RepoHandlerOptions = {}) {
  ipcMain.handle('git:open-repo', (_e, dirPath: string) =>
    wrap(async () => {
      assertString(dirPath, 'dirPath');
      const root = await ctx.openRepo(dirPath);
      options.onRepoOpened?.(root);
      await stripLegacyProfileKeys(root);
      const remoteUrl = await remote.getRemoteUrl(ctx).catch(() => null);
      const { url, host, protocol } = await resolveRemote(remoteUrl);
      return { root, remoteUrl: url, remoteHost: host, remoteProtocol: protocol };
    }),
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
    wrap(() => {
      assertBoundedLogLimit(limit);
      assertNonNegativeInteger(offset, 'offset');
      return history.getLog(ctx, limit, offset);
    }),
  );

  ipcMain.handle('git:get-status', () => wrap(() => status.getStatus(ctx)));

  ipcMain.handle('git:get-head-commit', () => wrap(() => history.getHeadCommit(ctx)));

  ipcMain.handle('git:get-identity', () => wrap(() => getIdentity(ctx.getRepoPath())));

  ipcMain.handle('git:set-identity', (_e, scope: unknown, identity: unknown) =>
    wrap(async () => {
      if (scope !== 'global' && scope !== 'local') throw new Error('Invalid argument: scope');
      assertIdentity(identity);
      await setIdentity(scope, ctx.getRepoPath(), identity);
    }),
  );

  ipcMain.handle('git:has-identity', () =>
    wrap(async () => {
      const root = ctx.getRepoPath();
      return root ? hasIdentity(root) : true;
    }),
  );
}
