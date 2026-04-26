import { ipcMain, dialog } from 'electron';
import { GitService } from './git-service';

const gitService = new GitService();

function wrap<T>(fn: () => Promise<T>) {
  return fn()
    .then((data) => ({ data }))
    .catch((err: Error) => ({ error: err.message, code: 'GIT_ERROR' }));
}

export function registerIpcHandlers() {
  ipcMain.handle('git:open-repo', (_e, dirPath: string) =>
    wrap(() => gitService.openRepo(dirPath).then(() => null)));

  ipcMain.handle('git:open-dialog', () =>
    wrap(async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Open Repository',
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      const dirPath = result.filePaths[0];
      await gitService.openRepo(dirPath);
      return dirPath;
    }));

  ipcMain.handle('git:get-log', (_e, limit: number, offset: number) =>
    wrap(() => gitService.getLog(limit, offset)));

  ipcMain.handle('git:get-branches', () =>
    wrap(() => gitService.getBranches()));

  ipcMain.handle('git:get-status', () =>
    wrap(() => gitService.getStatus()));

  ipcMain.handle('git:stage-files', (_e, paths: string[]) =>
    wrap(() => gitService.stageFiles(paths).then(() => null)));

  ipcMain.handle('git:unstage-files', (_e, paths: string[]) =>
    wrap(() => gitService.unstageFiles(paths).then(() => null)));

  ipcMain.handle('git:discard-changes', (_e, paths: string[]) =>
    wrap(() => gitService.discardChanges(paths).then(() => null)));

  ipcMain.handle('git:commit', (_e, message: string) =>
    wrap(() => gitService.commit(message)));

  ipcMain.handle('git:fetch', () =>
    wrap(() => gitService.fetch().then(() => null)));

  ipcMain.handle('git:pull', () =>
    wrap(() => gitService.pull()));

  ipcMain.handle('git:push', () =>
    wrap(() => gitService.push().then(() => null)));

  ipcMain.handle('git:checkout', (_e, branch: string) =>
    wrap(() => gitService.checkout(branch).then(() => null)));

  ipcMain.handle('git:merge', (_e, branch: string) =>
    wrap(() => gitService.merge(branch)));

  ipcMain.handle('git:rebase', (_e, branch: string) =>
    wrap(() => gitService.rebase(branch).then(() => null)));

  ipcMain.handle('git:delete-branch', (_e, branch: string) =>
    wrap(() => gitService.deleteBranch(branch).then(() => null)));

  ipcMain.handle('git:get-commit-diff', (_e, hash: string) =>
    wrap(() => gitService.getCommitDiff(hash)));

  ipcMain.handle('git:get-file-diff', (_e, hash: string, filePath: string) =>
    wrap(() => gitService.getFileDiff(hash, filePath)));

  ipcMain.handle('git:get-working-diff', (_e, filePath: string) =>
    wrap(() => gitService.getWorkingDiff(filePath)));

  ipcMain.handle('git:get-staged-diff', (_e, filePath: string) =>
    wrap(() => gitService.getStagedDiff(filePath)));

  ipcMain.handle('git:get-ahead-behind', () =>
    wrap(() => gitService.getAheadBehind()));

  ipcMain.handle('git:get-merge-conflicts', () =>
    wrap(() => gitService.getMergeConflicts()));

  ipcMain.handle('git:abort-merge', () =>
    wrap(() => gitService.abortMerge().then(() => null)));

  ipcMain.handle('git:mark-resolved', (_e, filePath: string) =>
    wrap(() => gitService.markResolved(filePath).then(() => null)));

  ipcMain.handle('git:stash', () =>
    wrap(() => gitService.stash().then(() => null)));

  ipcMain.handle('git:stash-pop', () =>
    wrap(() => gitService.stashPop().then(() => null)));

  ipcMain.handle('git:get-repo-path', () =>
    ({ data: gitService.getRepoPath() }));
}
