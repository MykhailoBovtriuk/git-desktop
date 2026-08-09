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

// Re-exported so existing importers (and tests) keep their entry point.
export { wrap };
export type IpcHandlerOptions = RepoHandlerOptions;

const gitService = new GitService();

let registered = false;

export function registerIpcHandlers(options: IpcHandlerOptions = {}) {
  // ipcMain.handle throws if a channel is registered twice; guard against
  // repeated calls (e.g. macOS window recreate on `activate`).
  if (registered) return;
  registered = true;

  registerRepoHandlers(gitService, options);
  registerStagingHandlers(gitService);
  registerRemoteHandlers(gitService);
  registerBranchHandlers(gitService);
  registerMergeHandlers(gitService);
  registerRebaseHandlers(gitService);
  registerStashHandlers(gitService);
  registerDiffHandlers(gitService);
  registerFileHandlers(gitService);
}
