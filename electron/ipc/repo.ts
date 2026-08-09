import { ipcMain, dialog } from 'electron';
import { GitService } from '../git-service';
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
      return root;
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
}
