import { ipcMain } from 'electron';
import { GitService } from '../git-service';
import { assertString, assertCommitHash, optionalBoolean } from '../ipc-validators';

const ignoreWhitespace = (value: unknown) => optionalBoolean(value, 'ignoreWhitespace');
import { wrap } from './wrap';

export function registerDiffHandlers(git: GitService) {
  ipcMain.handle('git:get-commit-diff', (_e, hash: string) =>
    wrap(() => {
      assertCommitHash(hash, 'hash');
      return git.getCommitDiff(hash);
    }),
  );

  ipcMain.handle('git:get-file-diff', (_e, hash: string, filePath: string, ws?: unknown) =>
    wrap(() => {
      assertCommitHash(hash, 'hash');
      assertString(filePath, 'filePath');
      return git.getFileDiff(hash, filePath, ignoreWhitespace(ws));
    }),
  );

  ipcMain.handle('git:get-working-diff', (_e, filePath: string, ws?: unknown) =>
    wrap(() => {
      assertString(filePath, 'filePath');
      return git.getWorkingDiff(filePath, ignoreWhitespace(ws));
    }),
  );

  ipcMain.handle('git:get-staged-diff', (_e, filePath: string, ws?: unknown) =>
    wrap(() => {
      assertString(filePath, 'filePath');
      return git.getStagedDiff(filePath, ignoreWhitespace(ws));
    }),
  );
}
