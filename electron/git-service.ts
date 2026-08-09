import type { Commit, Branch, GitStatus, StashEntry } from '../src/types';
import { GitContext, credentialSafeEnv } from './git/context';
import * as history from './git/history';
import * as status from './git/status';
import * as branches from './git/branches';
import * as remote from './git/remote';
import * as merge from './git/merge';
import * as rebase from './git/rebase';
import * as stash from './git/stash';
import * as files from './git/files';

export { credentialSafeEnv };

// Thin facade over the git domain modules: holds one GitContext and delegates
// each operation to its domain. Kept as the single object IPC handlers talk to.
export class GitService {
  private ctx = new GitContext();

  openRepo(dirPath: string): Promise<string> {
    return this.ctx.openRepo(dirPath);
  }
  getRepoPath(): string | null {
    return this.ctx.getRepoPath();
  }

  getLog(limit: number, offset: number): Promise<Commit[]> {
    return history.getLog(this.ctx, limit, offset);
  }
  getCommitDiff(hash: string): Promise<{ path: string; status: string }[]> {
    return history.getCommitDiff(this.ctx, hash);
  }
  getFileDiff(hash: string, filePath: string): Promise<string> {
    return history.getFileDiff(this.ctx, hash, filePath);
  }

  getStatus(): Promise<GitStatus & { ahead: number; behind: number }> {
    return status.getStatus(this.ctx);
  }
  stageFiles(paths: string[]): Promise<void> {
    return status.stageFiles(this.ctx, paths);
  }
  unstageFiles(paths: string[]): Promise<void> {
    return status.unstageFiles(this.ctx, paths);
  }
  discardChanges(paths: string[]): Promise<void> {
    return status.discardChanges(this.ctx, paths);
  }
  commit(message: string): Promise<string> {
    return status.commit(this.ctx, message);
  }
  applyPatch(patch: string, opts: { cached?: boolean; reverse?: boolean } = {}): Promise<void> {
    return status.applyPatch(this.ctx, patch, opts);
  }
  getWorkingDiff(filePath: string): Promise<string> {
    return status.getWorkingDiff(this.ctx, filePath);
  }
  getStagedDiff(filePath: string): Promise<string> {
    return status.getStagedDiff(this.ctx, filePath);
  }

  getBranches(): Promise<Branch[]> {
    return branches.getBranches(this.ctx);
  }
  checkout(branch: string): Promise<void> {
    return branches.checkout(this.ctx, branch);
  }
  checkoutForce(branch: string): Promise<void> {
    return branches.checkoutForce(this.ctx, branch);
  }
  deleteBranch(branch: string, force = false): Promise<void> {
    return branches.deleteBranch(this.ctx, branch, force);
  }
  deleteRemoteBranch(remoteName: string, branch: string): Promise<void> {
    return branches.deleteRemoteBranch(this.ctx, remoteName, branch);
  }

  fetch(): Promise<void> {
    return remote.fetch(this.ctx);
  }
  pull(): Promise<string> {
    return remote.pull(this.ctx);
  }
  push(): Promise<void> {
    return remote.push(this.ctx);
  }
  pushSetUpstream(remoteName: string, branch: string): Promise<void> {
    return remote.pushSetUpstream(this.ctx, remoteName, branch);
  }

  merge(branch: string): Promise<{ success: boolean; conflicts: string[] }> {
    return merge.merge(this.ctx, branch);
  }
  isMerging(): Promise<boolean> {
    return merge.isMerging(this.ctx);
  }
  concludeMerge(): Promise<void> {
    return merge.concludeMerge(this.ctx);
  }
  getMergeMessage(): Promise<string> {
    return merge.getMergeMessage(this.ctx);
  }
  getMergeConflicts(): Promise<string[]> {
    return merge.getMergeConflicts(this.ctx);
  }
  abortMerge(): Promise<void> {
    return merge.abortMerge(this.ctx);
  }
  markResolved(filePath: string): Promise<void> {
    return merge.markResolved(this.ctx, filePath);
  }
  getConflictSides(filePath: string): Promise<{ ours: string; theirs: string; base: string }> {
    return merge.getConflictSides(this.ctx, filePath);
  }

  rebase(branch: string): Promise<void> {
    return rebase.rebase(this.ctx, branch);
  }
  isRebasing(): Promise<boolean> {
    return rebase.isRebasing(this.ctx);
  }
  abortRebase(): Promise<void> {
    return rebase.abortRebase(this.ctx);
  }
  continueRebase(): Promise<void> {
    return rebase.continueRebase(this.ctx);
  }

  getStashList(): Promise<StashEntry[]> {
    return stash.getStashList(this.ctx);
  }
  stashSave(message?: string, staged = false): Promise<void> {
    return stash.stashSave(this.ctx, message, staged);
  }
  getStashTop(): Promise<string | null> {
    return stash.getStashTop(this.ctx);
  }
  stashApply(index: number): Promise<void> {
    return stash.stashApply(this.ctx, index);
  }
  stashPop(index: number): Promise<void> {
    return stash.stashPop(this.ctx, index);
  }
  stashDrop(index: number): Promise<void> {
    return stash.stashDrop(this.ctx, index);
  }
  getStashDiff(index: number): Promise<string> {
    return stash.getStashDiff(this.ctx, index);
  }

  readFile(filePath: string): Promise<string> {
    return files.readFile(this.ctx, filePath);
  }
  writeFile(filePath: string, content: string): Promise<void> {
    return files.writeFile(this.ctx, filePath, content);
  }
}
