import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertString, assertBranchName } from '../ipc-validators';
import { wrap, wrapLogged } from './wrap';

export function registerMergeHandlers(git: GitService) {
  ipcMain.handle('git:merge', (_e, branch: string) =>
    wrapLogged('merge', git, branch, () => {
      assertBranchName(branch, 'branch');
      return git.merge(branch);
    }),
  );

  ipcMain.handle('git:get-merge-conflicts', () => wrap(() => git.getMergeConflicts()));

  ipcMain.handle('git:abort-merge', () =>
    wrapLogged('merge-abort', git, undefined, () => git.abortMerge().then(() => null)),
  );

  ipcMain.handle('git:is-merging', () => wrap(() => git.isMerging()));

  ipcMain.handle('git:conclude-merge', () =>
    wrapLogged('merge-conclude', git, undefined, () => git.concludeMerge().then(() => null)),
  );

  ipcMain.handle('git:get-merge-message', () => wrap(() => git.getMergeMessage()));

  ipcMain.handle('git:mark-resolved', (_e, filePath: string) =>
    wrapLogged('resolve', git, filePath, () => {
      assertString(filePath, 'filePath');
      return git.markResolved(filePath).then(() => null);
    }),
  );

  ipcMain.handle('git:get-conflict-sides', (_e, p: string) =>
    wrap(() => {
      assertString(p, 'path');
      return git.getConflictSides(p);
    }),
  );
}
