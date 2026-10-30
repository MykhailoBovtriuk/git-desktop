import { ipcMain } from 'electron';
import { GitContext } from '../git/context';
import * as history from '../git/history';
import * as status from '../git/status';
import { assertString, assertCommitHash, optionalBoolean } from '../ipc-validators';

const ignoreWhitespace = (value: unknown) => optionalBoolean(value, 'ignoreWhitespace');
import { wrap } from './wrap';

export function registerDiffHandlers(ctx: GitContext) {
  ipcMain.handle('git:get-commit-diff', (_e, hash: string) =>
    wrap(() => {
      assertCommitHash(hash, 'hash');
      return history.getCommitDiff(ctx, hash);
    }),
  );

  ipcMain.handle('git:get-file-diff', (_e, hash: string, filePath: string, ws?: unknown) =>
    wrap(() => {
      assertCommitHash(hash, 'hash');
      assertString(filePath, 'filePath');
      return history.getFileDiff(ctx, hash, filePath, ignoreWhitespace(ws));
    }),
  );

  ipcMain.handle('git:get-working-diff', (_e, filePath: string, ws?: unknown) =>
    wrap(() => {
      assertString(filePath, 'filePath');
      return status.getWorkingDiff(ctx, filePath, ignoreWhitespace(ws));
    }),
  );

  ipcMain.handle('git:get-staged-diff', (_e, filePath: string, ws?: unknown) =>
    wrap(() => {
      assertString(filePath, 'filePath');
      return status.getStagedDiff(ctx, filePath, ignoreWhitespace(ws));
    }),
  );
}
