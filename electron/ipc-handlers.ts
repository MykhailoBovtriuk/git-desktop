import { ipcMain, dialog } from 'electron';
import { GitService } from './git-service';
import {
  assertString,
  assertOptionalString,
  assertStringArray,
  assertNonNegativeInteger,
  assertBoundedLogLimit,
  assertStashIndex,
  assertBranchName,
  assertCommitHash,
} from './ipc-validators';

const gitService = new GitService();

// Exported for unit tests. Validators throw synchronously, so `fn` must run
// inside the promise chain — otherwise the exception escapes the envelope.
export function wrap<T>(fn: () => Promise<T>) {
  return Promise.resolve()
    .then(fn)
    .then(data => ({ data }))
    .catch((err: unknown) => ({
      error: err instanceof Error ? err.message : String(err),
      code: 'GIT_ERROR',
    }));
}

let registered = false;

export function registerIpcHandlers() {
  // ipcMain.handle throws if a channel is registered twice; guard against
  // repeated calls (e.g. macOS window recreate on `activate`).
  if (registered) return;
  registered = true;

  ipcMain.handle('git:open-repo', (_e, dirPath: string) =>
    wrap(() => {
      assertString(dirPath, 'dirPath');
      return gitService.openRepo(dirPath);
    }),
  );

  ipcMain.handle('git:open-dialog', () =>
    wrap(async () => {
      // The dialog only selects a folder; opening/validating the repo is the
      // caller's job (store → openRepo), so we don't touch repo state here.
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
      return gitService.getLog(limit, offset);
    }),
  );

  ipcMain.handle('git:get-branches', () => wrap(() => gitService.getBranches()));

  ipcMain.handle('git:get-status', () => wrap(() => gitService.getStatus()));

  ipcMain.handle('git:stage-files', (_e, paths: string[]) =>
    wrap(() => {
      assertStringArray(paths, 'paths');
      return gitService.stageFiles(paths).then(() => null);
    }),
  );

  ipcMain.handle('git:unstage-files', (_e, paths: string[]) =>
    wrap(() => {
      assertStringArray(paths, 'paths');
      return gitService.unstageFiles(paths).then(() => null);
    }),
  );

  ipcMain.handle('git:discard-changes', (_e, paths: string[]) =>
    wrap(() => {
      assertStringArray(paths, 'paths');
      return gitService.discardChanges(paths).then(() => null);
    }),
  );

  ipcMain.handle('git:commit', (_e, message: string) =>
    wrap(() => {
      assertString(message, 'message');
      return gitService.commit(message);
    }),
  );

  ipcMain.handle('git:fetch', () => wrap(() => gitService.fetch().then(() => null)));

  ipcMain.handle('git:pull', () => wrap(() => gitService.pull()));

  ipcMain.handle('git:push', () => wrap(() => gitService.push().then(() => null)));

  ipcMain.handle('git:push-set-upstream', (_e, remote: string, branch: string) =>
    wrap(() => {
      assertBranchName(remote, 'remote');
      assertBranchName(branch, 'branch');
      return gitService.pushSetUpstream(remote, branch).then(() => null);
    }),
  );

  ipcMain.handle('git:checkout', (_e, branch: string) =>
    wrap(() => {
      assertBranchName(branch, 'branch');
      return gitService.checkout(branch).then(() => null);
    }),
  );

  ipcMain.handle('git:checkout-force', (_e, branch: string) =>
    wrap(() => {
      assertBranchName(branch, 'branch');
      return gitService.checkoutForce(branch).then(() => null);
    }),
  );

  ipcMain.handle('git:merge', (_e, branch: string) =>
    wrap(() => {
      assertBranchName(branch, 'branch');
      return gitService.merge(branch);
    }),
  );

  ipcMain.handle('git:rebase', (_e, branch: string) =>
    wrap(() => {
      assertBranchName(branch, 'branch');
      return gitService.rebase(branch).then(() => null);
    }),
  );

  ipcMain.handle('git:is-rebasing', () => wrap(() => gitService.isRebasing()));

  ipcMain.handle('git:abort-rebase', () => wrap(() => gitService.abortRebase().then(() => null)));

  ipcMain.handle('git:continue-rebase', () =>
    wrap(() => gitService.continueRebase().then(() => null)),
  );

  ipcMain.handle('git:delete-branch', (_e, branch: string, force?: boolean) =>
    wrap(() => {
      assertBranchName(branch, 'branch');
      if (force !== undefined && typeof force !== 'boolean') {
        throw new Error('Invalid argument: force must be a boolean');
      }
      return gitService.deleteBranch(branch, force ?? false).then(() => null);
    }),
  );

  ipcMain.handle('git:delete-remote-branch', (_e, remote: string, branch: string) =>
    wrap(() => {
      assertBranchName(remote, 'remote');
      assertBranchName(branch, 'branch');
      return gitService.deleteRemoteBranch(remote, branch).then(() => null);
    }),
  );

  ipcMain.handle('git:get-commit-diff', (_e, hash: string) =>
    wrap(() => {
      assertCommitHash(hash, 'hash');
      return gitService.getCommitDiff(hash);
    }),
  );

  ipcMain.handle('git:get-file-diff', (_e, hash: string, filePath: string) =>
    wrap(() => {
      assertCommitHash(hash, 'hash');
      assertString(filePath, 'filePath');
      return gitService.getFileDiff(hash, filePath);
    }),
  );

  ipcMain.handle('git:get-working-diff', (_e, filePath: string) =>
    wrap(() => {
      assertString(filePath, 'filePath');
      return gitService.getWorkingDiff(filePath);
    }),
  );

  ipcMain.handle('git:get-staged-diff', (_e, filePath: string) =>
    wrap(() => {
      assertString(filePath, 'filePath');
      return gitService.getStagedDiff(filePath);
    }),
  );

  ipcMain.handle('git:get-merge-conflicts', () => wrap(() => gitService.getMergeConflicts()));

  ipcMain.handle('git:abort-merge', () => wrap(() => gitService.abortMerge().then(() => null)));

  ipcMain.handle('git:is-merging', () => wrap(() => gitService.isMerging()));

  ipcMain.handle('git:conclude-merge', () =>
    wrap(() => gitService.concludeMerge().then(() => null)),
  );

  ipcMain.handle('git:get-merge-message', () => wrap(() => gitService.getMergeMessage()));

  ipcMain.handle('git:mark-resolved', (_e, filePath: string) =>
    wrap(() => {
      assertString(filePath, 'filePath');
      return gitService.markResolved(filePath).then(() => null);
    }),
  );

  ipcMain.handle('git:get-stash-list', () => wrap(() => gitService.getStashList()));

  ipcMain.handle('git:stash-save', (_e, message?: string, staged?: boolean) =>
    wrap(() => {
      assertOptionalString(message, 'message');
      if (staged !== undefined && typeof staged !== 'boolean') {
        throw new Error('Invalid argument: staged must be a boolean');
      }
      return gitService.stashSave(message, staged ?? false).then(() => null);
    }),
  );

  ipcMain.handle('git:get-stash-top', () => wrap(() => gitService.getStashTop()));

  ipcMain.handle('git:stash-apply', (_e, index: number) =>
    wrap(() => {
      assertStashIndex(index);
      return gitService.stashApply(index).then(() => null);
    }),
  );

  ipcMain.handle('git:stash-pop', (_e, index: number) =>
    wrap(() => {
      assertStashIndex(index);
      return gitService.stashPop(index).then(() => null);
    }),
  );

  ipcMain.handle('git:stash-drop', (_e, index: number) =>
    wrap(() => {
      assertStashIndex(index);
      return gitService.stashDrop(index).then(() => null);
    }),
  );

  ipcMain.handle('git:get-stash-diff', (_e, index: number) =>
    wrap(() => {
      assertStashIndex(index);
      return gitService.getStashDiff(index);
    }),
  );

  ipcMain.handle('git:get-repo-path', () => ({ data: gitService.getRepoPath() }));

  ipcMain.handle('git:read-file', (_e, p: string) =>
    wrap(() => {
      assertString(p, 'path');
      return gitService.readFile(p);
    }),
  );

  ipcMain.handle('git:write-file', (_e, p: string, c: string) =>
    wrap(() => {
      assertString(p, 'path');
      if (typeof c !== 'string') throw new Error('Invalid argument: content must be a string');
      return gitService.writeFile(p, c).then(() => null);
    }),
  );

  ipcMain.handle('git:get-conflict-sides', (_e, p: string) =>
    wrap(() => {
      assertString(p, 'path');
      return gitService.getConflictSides(p);
    }),
  );
}
