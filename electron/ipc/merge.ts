import { ipcMain } from 'electron';
import { GitContext } from '../git/context';
import * as merge from '../git/merge';
import { assertString, assertBranchName } from '../ipc-validators';
import { wrap, wrapLogged } from './wrap';

export function registerMergeHandlers(ctx: GitContext) {
  ipcMain.handle('git:merge', (_e, branch: string) =>
    wrapLogged('merge', ctx, branch, () => {
      assertBranchName(branch, 'branch');
      return merge.merge(ctx, branch);
    }),
  );

  ipcMain.handle('git:get-merge-conflicts', () => wrap(() => merge.getMergeConflicts(ctx)));

  ipcMain.handle('git:abort-merge', () =>
    wrapLogged('merge-abort', ctx, undefined, () => merge.abortMerge(ctx)),
  );

  ipcMain.handle('git:is-merging', () => wrap(() => merge.isMerging(ctx)));

  ipcMain.handle('git:conclude-merge', () =>
    wrapLogged('merge-conclude', ctx, undefined, () => merge.concludeMerge(ctx)),
  );

  ipcMain.handle('git:get-merge-message', () => wrap(() => merge.getMergeMessage(ctx)));

  ipcMain.handle('git:mark-resolved', (_e, filePath: string) =>
    wrapLogged('resolve', ctx, filePath, () => {
      assertString(filePath, 'filePath');
      return merge.markResolved(ctx, filePath);
    }),
  );
}
