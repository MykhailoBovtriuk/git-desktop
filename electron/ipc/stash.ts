import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertOptionalString, assertStashIndex, optionalBoolean } from '../ipc-validators';
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
        return git
          .stashSave(
            message,
            optionalBoolean(staged, 'staged'),
            optionalBoolean(includeUntracked, 'includeUntracked'),
          )
          .then(() => null);
      }),
  );

  ipcMain.handle('git:get-stash-top', () => wrap(() => git.getStashTop()));

  ipcMain.handle('git:stash-apply', (_e, index: number) =>
    wrapLogged('stash-apply', git, stashDetail(index), () => {
      assertStashIndex(index);
      return git.stashApply(index).then(() => null);
    }),
  );

  ipcMain.handle('git:stash-pop', (_e, index: number) =>
    wrapLogged('stash-pop', git, stashDetail(index), () => {
      assertStashIndex(index);
      return git.stashPop(index).then(() => null);
    }),
  );

  ipcMain.handle('git:stash-drop', (_e, index: number) =>
    wrapLogged('stash-drop', git, stashDetail(index), () => {
      assertStashIndex(index);
      return git.stashDrop(index).then(() => null);
    }),
  );

  ipcMain.handle('git:get-stash-diff', (_e, index: number) =>
    wrap(() => {
      assertStashIndex(index);
      return git.getStashDiff(index);
    }),
  );
}
