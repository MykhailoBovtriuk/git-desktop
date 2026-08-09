import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertString, assertStringArray } from '../ipc-validators';
import { wrap } from './wrap';

export function registerStagingHandlers(git: GitService) {
  ipcMain.handle('git:stage-files', (_e, paths: string[]) =>
    wrap(() => {
      assertStringArray(paths, 'paths');
      return git.stageFiles(paths).then(() => null);
    }),
  );

  ipcMain.handle('git:unstage-files', (_e, paths: string[]) =>
    wrap(() => {
      assertStringArray(paths, 'paths');
      return git.unstageFiles(paths).then(() => null);
    }),
  );

  ipcMain.handle('git:discard-changes', (_e, paths: string[]) =>
    wrap(() => {
      assertStringArray(paths, 'paths');
      return git.discardChanges(paths).then(() => null);
    }),
  );

  ipcMain.handle('git:commit', (_e, message: string) =>
    wrap(() => {
      assertString(message, 'message');
      return git.commit(message);
    }),
  );

  ipcMain.handle(
    'git:apply-patch',
    (_e, patch: string, opts?: { cached?: boolean; reverse?: boolean }) =>
      wrap(() => {
        assertString(patch, 'patch');
        const cached = opts?.cached;
        const reverse = opts?.reverse;
        if (cached !== undefined && typeof cached !== 'boolean') {
          throw new Error('Invalid argument: cached must be a boolean');
        }
        if (reverse !== undefined && typeof reverse !== 'boolean') {
          throw new Error('Invalid argument: reverse must be a boolean');
        }
        return git.applyPatch(patch, { cached, reverse }).then(() => null);
      }),
  );
}
