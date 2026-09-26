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
import { registerAccountHandlers } from './ipc/account';
import { registerAppHandlers, type AppHandlerOptions } from './ipc/app';
import { registerUpdateHandlers, type UpdateHandlerOptions } from './ipc/update';

export { wrap };
export type IpcHandlerOptions = RepoHandlerOptions & AppHandlerOptions & UpdateHandlerOptions;

const gitService = new GitService();

let registered = false;

export function registerIpcHandlers(options: IpcHandlerOptions = {}) {
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
  registerAccountHandlers(options);
  registerAppHandlers(options);
  registerUpdateHandlers(options);
}
