import { ipcMain, dialog } from 'electron';
import { GitService } from '../git-service';
import { resolveRemoteHost } from '../auth/remote-host';
import { stripLegacyProfileKeys } from '../auth/legacy-cleanup';
import { hasIdentity } from '../auth/identity-bootstrap';
import { assertString, assertBoundedLogLimit, assertNonNegativeInteger } from '../ipc-validators';
import { wrap } from './wrap';

export interface RepoHandlerOptions {
  onRepoOpened?: (root: string) => void;
}

export function registerRepoHandlers(git: GitService, options: RepoHandlerOptions = {}) {
  ipcMain.handle('git:open-repo', (_e, dirPath: string) =>
    wrap(async () => {
      assertString(dirPath, 'dirPath');
      const root = await git.openRepo(dirPath);
      options.onRepoOpened?.(root);
      await stripLegacyProfileKeys(root);
      // The host decides which account applies and whether to offer sign-in, so
      // it travels with the repo rather than costing a second round trip.
      const remoteUrl = await git.getRemoteUrl().catch(() => null);
      return { root, remoteHost: await resolveRemoteHost(remoteUrl) };
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
      return git.getLog(limit, offset);
    }),
  );

  ipcMain.handle('git:get-status', () => wrap(() => git.getStatus()));

  ipcMain.handle('git:get-repo-path', () => ({ data: git.getRepoPath() }));

  // One boolean, not a resolved identity: the only thing the UI does with it is
  // stop a commit that git would reject outright for having no author.
  ipcMain.handle('git:has-identity', () =>
    wrap(async () => {
      const root = git.getRepoPath();
      return root ? hasIdentity(root) : true;
    }),
  );
}
