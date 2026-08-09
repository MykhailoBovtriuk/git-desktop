import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertOptionalString, assertStashIndex } from '../ipc-validators';
import { wrap } from './wrap';

export function registerStashHandlers(git: GitService) {
  ipcMain.handle('git:get-stash-list', () => wrap(() => git.getStashList()));

  ipcMain.handle('git:stash-save', (_e, message?: string, staged?: boolean) =>
    wrap(() => {
      assertOptionalString(message, 'message');
      if (staged !== undefined && typeof staged !== 'boolean') {
        throw new Error('Invalid argument: staged must be a boolean');
      }
      return git.stashSave(message, staged ?? false).then(() => null);
    }),
  );

  ipcMain.handle('git:get-stash-top', () => wrap(() => git.getStashTop()));

  ipcMain.handle('git:stash-apply', (_e, index: number) =>
    wrap(() => {
      assertStashIndex(index);
      return git.stashApply(index).then(() => null);
    }),
  );

  ipcMain.handle('git:stash-pop', (_e, index: number) =>
    wrap(() => {
      assertStashIndex(index);
      return git.stashPop(index).then(() => null);
    }),
  );

  ipcMain.handle('git:stash-drop', (_e, index: number) =>
    wrap(() => {
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
