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
      if (get().epoch !== startedEpoch || get().commits !== commits) return;
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
    let merging = false;
    try {
      merging = await gitApi.isMerging();
    } catch {
      merging = false;
    }
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
