import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertString, assertStringArray, optionalBoolean } from '../ipc-validators';
import { wrap, wrapLogged } from './wrap';

/** One path by name, several by count: the full list is in the git command itself. */
function pathsDetail(paths: unknown): string | undefined {
  if (!Array.isArray(paths) || paths.length === 0) return undefined;
  return paths.length === 1 ? String(paths[0]) : `${paths.length} files`;
}

export function registerStagingHandlers(git: GitService) {
  ipcMain.handle('git:stage-files', (_e, paths: string[]) =>
    wrapLogged('stage', git, pathsDetail(paths), () => {
      assertStringArray(paths, 'paths');
      return git.stageFiles(paths).then(() => null);
    }),
  );

  ipcMain.handle('git:unstage-files', (_e, paths: string[]) =>
    wrapLogged('unstage', git, pathsDetail(paths), () => {
      assertStringArray(paths, 'paths');
      return git.unstageFiles(paths).then(() => null);
    }),
  );

  ipcMain.handle('git:discard-changes', (_e, paths: string[]) =>
    wrapLogged('discard', git, pathsDetail(paths), () => {
      assertStringArray(paths, 'paths');
      return git.discardChanges(paths).then(() => null);
    }),
  );

  ipcMain.handle('git:commit', (_e, message: string) =>
    wrapLogged('commit', git, message, () => {
      assertString(message, 'message');
      return git.commit(message);
    }),
  );

  ipcMain.handle(
    'git:apply-patch',
    (_e, patch: string, opts?: { cached?: boolean; reverse?: boolean }) =>
      wrap(() => {
        assertString(patch, 'patch');
        const cached = optionalBoolean(opts?.cached, 'cached');
        const reverse = optionalBoolean(opts?.reverse, 'reverse');
        return git.applyPatch(patch, { cached, reverse }).then(() => null);
      }),
  );
}
