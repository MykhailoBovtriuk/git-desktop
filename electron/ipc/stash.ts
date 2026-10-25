import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertNonNegativeInteger, assertOptionalString, optionalBoolean } from '../ipc-validators';
import { wrap, wrapLogged } from './wrap';

function stashDetail(index: unknown): string | undefined {
  return typeof index === 'number' ? `stash@{${index}}` : undefined;
}

export function registerStashHandlers(git: GitService) {
  ipcMain.handle('git:get-stash-list', () => wrap(() => git.getStashList()));

  ipcMain.handle(
    'git:stash-save',
    (_e, message?: string, staged?: boolean, includeUntracked?: boolean) =>
      wrapLogged('stash-save', git, message, () => {
        assertOptionalString(message, 'message');
        return git.stashSave(
          message,
          optionalBoolean(staged, 'staged'),
          optionalBoolean(includeUntracked, 'includeUntracked'),
        );
      }),
  );

  ipcMain.handle('git:get-stash-top', () => wrap(() => git.getStashTop()));

  ipcMain.handle('git:stash-apply', (_e, index: number) =>
    wrapLogged('stash-apply', git, stashDetail(index), () => {
      assertNonNegativeInteger(index, 'index');
      return git.stashApply(index);
    }),
  );

  ipcMain.handle('git:stash-pop', (_e, index: number) =>
    wrapLogged('stash-pop', git, stashDetail(index), () => {
      assertNonNegativeInteger(index, 'index');
      return git.stashPop(index);
    }),
  );

  ipcMain.handle('git:stash-drop', (_e, index: number) =>
    wrapLogged('stash-drop', git, stashDetail(index), () => {
      assertNonNegativeInteger(index, 'index');
      return git.stashDrop(index);
    }),
  );

  ipcMain.handle('git:get-stash-diff', (_e, index: number) =>
    wrap(() => {
      assertNonNegativeInteger(index, 'index');
      return git.getStashDiff(index);
    }),
  );
}
