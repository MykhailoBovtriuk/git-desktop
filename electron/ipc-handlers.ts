import { GitContext } from './git/context';
import { wrapLoggedFor } from './ipc/wrap';
import { registerRepoHandlers, type RepoHandlerOptions } from './ipc/repo';
import { registerStagingHandlers } from './ipc/staging';
import { registerRemoteHandlers } from './ipc/remote';
import { registerBranchHandlers } from './ipc/branches';
import { registerMergeHandlers } from './ipc/merge';
import { registerRebaseHandlers } from './ipc/rebase';
import { registerStashHandlers } from './ipc/stash';
import { registerDiffHandlers } from './ipc/diff';
import { registerFileHandlers } from './ipc/files';
import { forgetRepoAccount, registerAccountHandlers } from './ipc/account';
import { registerAppHandlers } from './ipc/app';
import { registerUpdateHandlers } from './ipc/update';
import { registerLogHandlers, type LogHandlerOptions } from './ipc/logs';
import { registerTerminalHandlers, type TerminalControl } from './ipc/terminal';
import { ipcMain } from 'electron';
import { assertRepoPath } from './ipc-validators';

export type IpcHandlerOptions = RepoHandlerOptions & LogHandlerOptions;

const gitContext = new GitContext();

let registered = false;
let terminals: TerminalControl | null = null;

export function killAllTerminals(): void {
  terminals?.killAll();
}

export function registerIpcHandlers(options: IpcHandlerOptions = {}) {
  if (registered) return;
  registered = true;

  const logStore = registerLogHandlers({ ...options, getRepoPath: () => gitContext.getRepoPath() });
  terminals = registerTerminalHandlers(options);
  const terminalControl = terminals;

  ipcMain.handle('repo:forget', (_e, repoPath: unknown) =>
    wrapLoggedFor('repo-forget', null, repoPath, async () => {
      assertRepoPath(repoPath);
      terminalControl.killRepo(repoPath);
      // Logged to the app log, and signed out before the repository's own log
      // is deleted, so nothing is written back into it.
      await forgetRepoAccount(repoPath);
      await logStore.forgetRepo(repoPath);
    }),
  );
  registerRepoHandlers(gitContext, {
    ...options,
    onRepoOpened: root => {
      options.onRepoOpened?.(root);
      void logStore.ensureRepo(root).catch(() => {});
    },
  });
  registerStagingHandlers(gitContext);
  registerRemoteHandlers(gitContext);
  registerBranchHandlers(gitContext);
  registerMergeHandlers(gitContext);
  registerRebaseHandlers(gitContext);
  registerStashHandlers(gitContext);
  registerDiffHandlers(gitContext);
  registerFileHandlers(gitContext);
  registerAccountHandlers(options);
  registerAppHandlers(options);
  registerUpdateHandlers(options);
}
