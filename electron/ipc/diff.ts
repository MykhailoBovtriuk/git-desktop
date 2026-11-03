import { ipcMain } from 'electron';
import { GitContext } from '../git/context';
import * as history from '../git/history';
import * as status from '../git/status';
import { assertString, assertCommitHash, optionalBoolean } from '../ipc-validators';

import { wrapRead } from './wrap';

const ignoreWhitespace = (value: unknown) => optionalBoolean(value, 'ignoreWhitespace');

export function registerDiffHandlers(ctx: GitContext) {
  ipcMain.handle('git:get-commit-diff', (_e, hash: string) =>
    wrapRead(ctx, `commit ${String(hash).slice(0, 7)}`, async () => {
      assertCommitHash(hash, 'hash');
      return history.getCommitDiff(ctx, hash);
    }),
  );

  ipcMain.handle('git:get-file-diff', (_e, hash: string, filePath: string, ws?: unknown) =>
    wrapRead(ctx, `diff ${String(hash).slice(0, 7)} ${filePath}`, async () => {
      assertCommitHash(hash, 'hash');
      assertString(filePath, 'filePath');
      return history.getFileDiff(ctx, hash, filePath, ignoreWhitespace(ws));
    }),
  );

  ipcMain.handle('git:get-working-diff', (_e, filePath: string, ws?: unknown) =>
    wrapRead(ctx, `diff ${filePath}`, async () => {
      assertString(filePath, 'filePath');
      return status.getWorkingDiff(ctx, filePath, ignoreWhitespace(ws));
    }),
  );

  ipcMain.handle('git:get-staged-diff', (_e, filePath: string, ws?: unknown) =>
    wrapRead(ctx, `staged diff ${filePath}`, async () => {
      assertString(filePath, 'filePath');
      return status.getStagedDiff(ctx, filePath, ignoreWhitespace(ws));
    }),
  );
}
