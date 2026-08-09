import type { StoreApi } from 'zustand';
import type { Commit, Branch, GitStatus, AheadBehind, MergeState, StashEntry } from '../../types';

// Commits are loaded a page at a time; the log view offers "load more" rather
// than fetching an unbounded history for large repos.
export const LOG_PAGE_SIZE = 200;

export interface RepoState {
  // Generation counter: bumped when the repo is switched or a mutating
  // operation starts/ends. Every loader captures it before its request and
  // discards the response if the generation moved on — stale data from a
  // previous repo or from before a mutation never overwrites fresh state.
  epoch: number;
  // Number of tracked operations currently in flight. busyOperation is kept
  // as the display name and only clears when the count reaches zero.
  busyCount: number;
  repoPath: string | null;
  recentRepos: string[];
  commits: Commit[];
  branches: Branch[];
  currentBranch: string;
  status: GitStatus;
  aheadBehind: AheadBehind;
  mergeState: MergeState | null;
  merging: boolean;
  // True while git is mid-rebase (rebase-apply/rebase-merge present). Drives the
  // RebaseBanner: unlike merge, a rebase conflict has no dedicated modal state —
  // the conflicting files come straight from `status` (unmerged 'U' entries).
  rebasing: boolean;
  checkoutConflict: { branch: string } | null;
  stashes: StashEntry[];
  // Pagination for the commit log. hasMoreCommits is true when the backend
  // still has older commits beyond what's loaded; loadingMoreCommits guards the
  // "load more" action against re-entrancy.
  hasMoreCommits: boolean;
  loadingMoreCommits: boolean;
  loadMoreCommits: () => Promise<void>;
  // Name of the in-flight tracked operation (commit/checkout/push/…), or null
  // when idle. Auto-refresh stands aside while this is set (see useAutoRefresh).
  busyOperation: string | null;
  // Aggregated message of any loader that failed during the last refresh, or
  // null if the last refresh fully succeeded. Lets refresh fail partially
  // without tearing down the segments that did load.
  lastRefreshError: string | null;
  runOperation: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  loadStashes: () => Promise<void>;
  stashSave: (message?: string, staged?: boolean) => Promise<void>;
  stashApply: (index: number) => Promise<void>;
  stashPop: (index: number) => Promise<void>;
  stashDrop: (index: number) => Promise<void>;
  openRepo: (path: string) => Promise<void>;
  openDialog: () => Promise<void>;
  loadLog: () => Promise<void>;
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
  deleteBranch: (branch: string, force?: boolean) => Promise<void>;
  deleteRemoteBranch: (remote: string, branch: string) => Promise<void>;
  abortMerge: () => Promise<void>;
  clearMergeState: () => void;
  concludeMerge: () => Promise<void>;
  abortRebase: () => Promise<void>;
  continueRebase: () => Promise<void>;
}

// A slice contributes part of the store, receiving the real setState/getState.
export type RepoSet = StoreApi<RepoState>['setState'];
export type RepoGet = StoreApi<RepoState>['getState'];
export type RepoSlice<T> = (set: RepoSet, get: RepoGet) => T;
