import type { StoreApi } from 'zustand';
import type {
  Commit,
  Branch,
  GitStatus,
  AheadBehind,
  MergeState,
  RemoteProtocol,
  StashEntry,
} from '../../types';

export const LOG_PAGE_SIZE = 200;

export interface RepoState {
  // Generation counter, bumped on repo switch and around mutations; loaders
  // discard responses from an older generation.
  epoch: number;
  busyCount: number;
  repoPath: string | null;
  recentRepos: string[];
  commits: Commit[];
  /** Abbreviated hash of HEAD — the user's own position, unlike commits[0]. */
  headCommit: string | null;
  branches: Branch[];
  currentBranch: string;
  status: GitStatus;
  aheadBehind: AheadBehind;
  mergeState: MergeState | null;
  merging: boolean;
  rebasing: boolean;
  checkoutConflict: { branch: string } | null;
  stashes: StashEntry[];
  hasMoreCommits: boolean;
  loadingMoreCommits: boolean;
  loadMoreCommits: () => Promise<void>;
  busyOperation: string | null;
  lastRefreshError: string | null;
  runOperation: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  loadStashes: () => Promise<void>;
  stashSave: (message?: string, staged?: boolean) => Promise<void>;
  stashApply: (index: number) => Promise<void>;
  stashPop: (index: number) => Promise<void>;
  stashDrop: (index: number) => Promise<void>;
  openRepo: (path: string) => Promise<void>;
  /** Host of the open repository's remote, or null for a local-only repo. */
  remoteHost: string | null;
  /** How that remote authenticates — only an https one a token can help with. */
  remoteProtocol: RemoteProtocol | null;
  /**
   * Whether git has an author to commit as. Null until known — an unknown
   * answer must never block a commit, only a definite "no" does.
   */
  hasIdentity: boolean | null;
  loadIdentity: () => Promise<void>;
  openDialog: () => Promise<void>;
  removeRecentRepo: (path: string) => void;
  loadLog: () => Promise<void>;
  loadHeadCommit: () => Promise<void>;
  loadBranches: () => Promise<void>;
  loadStatus: () => Promise<void>;
  refresh: () => Promise<void>;
  stageFiles: (paths: string[]) => Promise<void>;
  unstageFiles: (paths: string[]) => Promise<void>;
  stageHunk: (patch: string) => Promise<void>;
  unstageHunk: (patch: string) => Promise<void>;
  discardChanges: (paths: string[]) => Promise<void>;
  commit: (message: string) => Promise<void>;
  fetch: () => Promise<void>;
  pull: () => Promise<string>;
  push: () => Promise<void>;
  publishBranch: () => Promise<void>;
  checkout: (branch: string) => Promise<void>;
  stashAndCheckout: () => Promise<void>;
  migrateCheckout: () => Promise<void>;
  forceCheckout: () => Promise<void>;
  cancelCheckout: () => void;
  merge: (branch: string) => Promise<void>;
  rebase: (branch: string) => Promise<void>;
  /**
   * Create a branch here and switch to it; `changes` is 'bring' (keep the work)
   * or 'leave' (stash it first).
   */
  createBranch: (name: string, changes: 'bring' | 'leave') => Promise<void>;
  deleteBranch: (branch: string, force?: boolean) => Promise<void>;
  deleteRemoteBranch: (remote: string, branch: string) => Promise<void>;
  abortMerge: () => Promise<void>;
  clearMergeState: () => void;
  concludeMerge: () => Promise<void>;
  abortRebase: () => Promise<void>;
  continueRebase: () => Promise<void>;
}

export type RepoSet = StoreApi<RepoState>['setState'];
export type RepoGet = StoreApi<RepoState>['getState'];
export type RepoSlice<T> = (set: RepoSet, get: RepoGet) => T;
