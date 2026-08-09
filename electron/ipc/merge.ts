import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertString, assertBranchName } from '../ipc-validators';
import { wrap } from './wrap';

export function registerMergeHandlers(git: GitService) {
  ipcMain.handle('git:merge', (_e, branch: string) =>
    wrap(() => {
      assertBranchName(branch, 'branch');
      return git.merge(branch);
    }),
  );

  ipcMain.handle('git:get-merge-conflicts', () => wrap(() => git.getMergeConflicts()));

  ipcMain.handle('git:abort-merge', () => wrap(() => git.abortMerge().then(() => null)));

  ipcMain.handle('git:is-merging', () => wrap(() => git.isMerging()));

  ipcMain.handle('git:conclude-merge', () => wrap(() => git.concludeMerge().then(() => null)));

  ipcMain.handle('git:get-merge-message', () => wrap(() => git.getMergeMessage()));

  ipcMain.handle('git:mark-resolved', (_e, filePath: string) =>
    wrap(() => {
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
