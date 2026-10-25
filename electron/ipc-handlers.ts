import { GitService } from './git-service';
import { wrap } from './ipc/wrap';
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

const gitService = new GitService();

let registered = false;
let terminals: TerminalControl | null = null;

export function killAllTerminals(): void {
  terminals?.killAll();
}

export function registerIpcHandlers(options: IpcHandlerOptions = {}) {
  if (registered) return;
  registered = true;

  const logStore = registerLogHandlers(options);
  terminals = registerTerminalHandlers(options);
  const terminalControl = terminals;

  ipcMain.handle('repo:forget', (_e, repoPath: unknown) =>
    wrap(async () => {
      assertRepoPath(repoPath);
      terminalControl.killRepo(repoPath);
      await logStore.forgetRepo(repoPath);
      await forgetRepoAccount(repoPath);
    }),
  );
  registerRepoHandlers(gitService, {
    ...options,
    onRepoOpened: root => {
      options.onRepoOpened?.(root);
      void logStore.ensureRepo(root).catch(() => {});
    },
  });
  registerStagingHandlers(gitService);
  registerRemoteHandlers(gitService);
  registerBranchHandlers(gitService);
  registerMergeHandlers(gitService);
  registerRebaseHandlers(gitService);
  registerStashHandlers(gitService);
  registerDiffHandlers(gitService);
  registerFileHandlers(gitService);
  registerAccountHandlers(options);
  registerAppHandlers(options);
  registerUpdateHandlers(options);
}
