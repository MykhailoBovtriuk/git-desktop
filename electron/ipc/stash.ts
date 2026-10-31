import { ipcMain } from 'electron';
import { GitContext } from '../git/context';
import * as stash from '../git/stash';
import { assertNonNegativeInteger, assertOptionalString, optionalBoolean } from '../ipc-validators';
import { wrap, wrapLogged } from './wrap';

function stashDetail(index: unknown): string | undefined {
  return typeof index === 'number' ? `stash@{${index}}` : undefined;
}

export function registerStashHandlers(ctx: GitContext) {
  ipcMain.handle('git:get-stash-list', () => wrap(() => stash.getStashList(ctx)));

  ipcMain.handle(
    'git:stash-save',
    (_e, message?: string, staged?: boolean, includeUntracked?: boolean) =>
      wrapLogged('stash-save', ctx, message, () => {
        assertOptionalString(message, 'message');
        return stash.stashSave(
          ctx,
          message,
          optionalBoolean(staged, 'staged'),
          optionalBoolean(includeUntracked, 'includeUntracked'),
        );
      }),
  );

  ipcMain.handle('git:get-stash-top', () => wrap(() => stash.getStashTop(ctx)));

  ipcMain.handle('git:stash-apply', (_e, index: number) =>
    wrapLogged('stash-apply', ctx, stashDetail(index), () => {
      assertNonNegativeInteger(index, 'index');
      return stash.stashApply(ctx, index);
    }),
  );

  ipcMain.handle('git:stash-pop', (_e, index: number) =>
    wrapLogged('stash-pop', ctx, stashDetail(index), () => {
      assertNonNegativeInteger(index, 'index');
      return stash.stashPop(ctx, index);
    }),
  );

  ipcMain.handle('git:stash-drop', (_e, index: number) =>
    wrapLogged('stash-drop', ctx, stashDetail(index), () => {
      assertNonNegativeInteger(index, 'index');
      return stash.stashDrop(ctx, index);
    }),
  );

  ipcMain.handle('git:get-stash-diff', (_e, index: number) =>
    wrap(() => {
      assertNonNegativeInteger(index, 'index');
      return stash.getStashDiff(ctx, index);
    }),
  );
}
