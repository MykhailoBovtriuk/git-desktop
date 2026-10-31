import { ipcMain } from 'electron';
import { GitContext } from '../git/context';
import * as status from '../git/status';
import { assertString, assertStringArray, optionalBoolean } from '../ipc-validators';
import { wrapLogged } from './wrap';

function pathsDetail(paths: unknown): string | undefined {
  if (!Array.isArray(paths) || paths.length === 0) return undefined;
  return paths.length === 1 ? String(paths[0]) : `${paths.length} files`;
}

export function registerStagingHandlers(ctx: GitContext) {
  ipcMain.handle('git:stage-files', (_e, paths: string[]) =>
    wrapLogged('stage', ctx, pathsDetail(paths), () => {
      assertStringArray(paths, 'paths');
      return status.stageFiles(ctx, paths);
    }),
  );

  ipcMain.handle('git:unstage-files', (_e, paths: string[]) =>
    wrapLogged('unstage', ctx, pathsDetail(paths), () => {
      assertStringArray(paths, 'paths');
      return status.unstageFiles(ctx, paths);
    }),
  );

  ipcMain.handle('git:discard-changes', (_e, paths: string[]) =>
    wrapLogged('discard', ctx, pathsDetail(paths), () => {
      assertStringArray(paths, 'paths');
      return status.discardChanges(ctx, paths);
    }),
  );

  ipcMain.handle('git:commit', (_e, message: string) =>
    wrapLogged('commit', ctx, message, () => {
      assertString(message, 'message');
      return status.commit(ctx, message);
    }),
  );

  ipcMain.handle(
    'git:apply-patch',
    (_e, patch: string, opts?: { cached?: boolean; reverse?: boolean }) =>
      wrapLogged(
        opts?.cached !== true ? 'discard' : opts.reverse === true ? 'unstage' : 'stage',
        ctx,
        undefined,
        async () => {
          assertString(patch, 'patch');
          const cached = optionalBoolean(opts?.cached, 'cached');
          const reverse = optionalBoolean(opts?.reverse, 'reverse');
          return status.applyPatch(ctx, patch, { cached, reverse });
        },
      ),
  );
}
