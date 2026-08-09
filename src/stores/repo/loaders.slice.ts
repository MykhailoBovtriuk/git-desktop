import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';
import { LOG_PAGE_SIZE } from './types';

type LoadersSlice = Pick<
  RepoState,
  | 'commits'
  | 'branches'
  | 'currentBranch'
  | 'status'
  | 'aheadBehind'
  | 'merging'
  | 'rebasing'
  | 'stashes'
  | 'hasMoreCommits'
  | 'loadingMoreCommits'
  | 'loadLog'
  | 'loadMoreCommits'
  | 'loadBranches'
  | 'loadStatus'
  | 'loadStashes'
>;

export const createLoadersSlice: RepoSlice<LoadersSlice> = (set, get) => ({
  commits: [],
  branches: [],
  currentBranch: '',
  status: { staged: [], unstaged: [] },
  aheadBehind: { ahead: 0, behind: 0 },
  merging: false,
  rebasing: false,
  stashes: [],
  hasMoreCommits: false,
  loadingMoreCommits: false,

  loadLog: async () => {
    const startedEpoch = get().epoch;
    // Fetch one extra to detect whether older commits remain, then trim to the
    // page size so `hasMoreCommits` reflects reality without a separate count.
    const page = await gitApi.getLog(LOG_PAGE_SIZE + 1, 0);
    if (get().epoch !== startedEpoch) return;
    set({
      commits: page.slice(0, LOG_PAGE_SIZE),
      hasMoreCommits: page.length > LOG_PAGE_SIZE,
    });
  },

  loadMoreCommits: async () => {
    const { hasMoreCommits, loadingMoreCommits, commits, epoch: startedEpoch } = get();
    if (!hasMoreCommits || loadingMoreCommits) return;
    set({ loadingMoreCommits: true });
    try {
      const page = await gitApi.getLog(LOG_PAGE_SIZE + 1, commits.length);
      // Discard when the log was reloaded meanwhile (refresh or repo switch):
      // the offset no longer matches and the base array is gone.
      if (get().epoch !== startedEpoch || get().commits !== commits) return;
      // Dedupe on append: `git log --all --skip=N` shifts when new commits
      // land at the top, so the page can overlap the tail of what's loaded.
      // Drop already-present hashes to avoid duplicate rows/React keys.
      const seen = new Set(commits.map(c => c.hash));
      const fresh = page.slice(0, LOG_PAGE_SIZE).filter(c => !seen.has(c.hash));
      set({
        commits: [...commits, ...fresh],
        hasMoreCommits: page.length > LOG_PAGE_SIZE,
      });
    } finally {
      set({ loadingMoreCommits: false });
    }
  },

  loadBranches: async () => {
    const startedEpoch = get().epoch;
    const branches = await gitApi.getBranches();
    if (get().epoch !== startedEpoch) return;
    const current = branches.find(b => b.current);
    set({ branches, currentBranch: current?.name ?? '' });
  },

  loadStatus: async () => {
    const startedEpoch = get().epoch;
    const result = await gitApi.getStatus();
    // isMerging must never block the status update: if it fails (e.g. an older
    // main process without the handler), default to false instead of throwing
    // — otherwise status/merging freeze on stale values.
    let merging = false;
    try {
      merging = await gitApi.isMerging();
    } catch {
      merging = false;
    }
    // Same defensive default as merging: an older main process without the
    // handler must not freeze status on a stale rebasing value.
    let rebasing = false;
    try {
      rebasing = await gitApi.isRebasing();
    } catch {
      rebasing = false;
    }
    if (get().epoch !== startedEpoch) return;
    set({
      status: { staged: result.staged, unstaged: result.unstaged },
      aheadBehind: { ahead: result.ahead, behind: result.behind },
      merging,
      rebasing,
    });
  },

  loadStashes: async () => {
    if (!get().repoPath) return;
    try {
      const list = await gitApi.getStashList();
      set({ stashes: list });
    } catch {
      set({ stashes: [] });
    }
  },
});
