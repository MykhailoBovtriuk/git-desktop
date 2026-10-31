import type { StoreApi } from 'zustand';
import type {
  Commit,
  Branch,
  GitStatus,
  AheadBehind,
  MergeState,
  RemoteProtocol,
  StashEntry,
  SwitchableProtocol,
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
  lastRefreshError: string | null;
  runOperation: <T>(fn: () => Promise<T>) => Promise<T>;
  loadStashes: () => Promise<void>;
  stashSave: (message?: string, staged?: boolean) => Promise<void>;
  stashApply: (index: number) => Promise<void>;
  stashPop: (index: number) => Promise<void>;
  stashDrop: (index: number) => Promise<void>;
  openRepo: (path: string) => Promise<void>;
  remoteUrl: string | null;
  remoteHost: string | null;
  remoteProtocol: RemoteProtocol | null;
  switchRemoteProtocol: (to: SwitchableProtocol) => Promise<void>;
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
  createBranch: (name: string, changes: 'bring' | 'leave') => Promise<void>;
  deleteBranch: (branch: string, force?: boolean) => Promise<void>;
  deleteRemoteBranch: (remote: string, branch: string) => Promise<void>;
  abortMerge: () => Promise<void>;
  clearMergeState: () => void;
  concludeMerge: () => Promise<void>;
  abortRebase: () => Promise<void>;
  continueRebase: () => Promise<void>;
}

type RepoSet = StoreApi<RepoState>['setState'];
type RepoGet = StoreApi<RepoState>['getState'];
export type RepoSlice<T> = (set: RepoSet, get: RepoGet) => T;
