import { ipcMain } from 'electron';
import { GitContext } from '../git/context';
import * as merge from '../git/merge';
import { assertString, assertBranchName } from '../ipc-validators';
import { wrapLogged, wrapRead } from './wrap';
import { markCurrent } from '../log/git-logger';

export function registerMergeHandlers(ctx: GitContext) {
  ipcMain.handle('git:merge', (_e, branch: string) =>
    wrapLogged('merge', ctx, branch, async () => {
      assertBranchName(branch, 'branch');
      const result = await merge.merge(ctx, branch);
      if (result.conflicts.length) {
        markCurrent({
          status: 'warning',
          error: `Stopped on conflicts in ${result.conflicts.length} file(s): ${result.conflicts.join(', ')}`,
        });
      }
      return result;
    }),
  );

  ipcMain.handle('git:get-merge-conflicts', () =>
    wrapRead(ctx, 'conflicts', () => merge.getMergeConflicts(ctx)),
  );

  ipcMain.handle('git:abort-merge', () =>
    wrapLogged('merge-abort', ctx, undefined, () => merge.abortMerge(ctx)),
  );

  ipcMain.handle('git:is-merging', () => wrapRead(ctx, 'merge state', () => merge.isMerging(ctx)));

  ipcMain.handle('git:conclude-merge', () =>
    wrapLogged('merge-conclude', ctx, undefined, () => merge.concludeMerge(ctx)),
  );

  ipcMain.handle('git:get-merge-message', () =>
    wrapRead(ctx, 'merge message', () => merge.getMergeMessage(ctx)),
  );

  ipcMain.handle('git:mark-resolved', (_e, filePath: string) =>
    wrapLogged('resolve', ctx, filePath, () => {
      assertString(filePath, 'filePath');
      return merge.markResolved(ctx, filePath);
    }),
  );
}
