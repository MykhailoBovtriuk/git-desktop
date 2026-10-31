import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';
import { LOG_PAGE_SIZE } from './types';
import { whileCurrent } from './epoch';

type LoadersSlice = Pick<
  RepoState,
  | 'commits'
  | 'headCommit'
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
  | 'loadHeadCommit'
  | 'loadMoreCommits'
  | 'loadBranches'
  | 'loadStatus'
  | 'loadStashes'
>;

export const createLoadersSlice: RepoSlice<LoadersSlice> = (set, get) => ({
  commits: [],
  headCommit: null,
  branches: [],
  currentBranch: '',
  status: { staged: [], unstaged: [] },
  aheadBehind: { ahead: 0, behind: 0, upstream: null },
  merging: false,
  rebasing: false,
  stashes: [],
  hasMoreCommits: false,
  loadingMoreCommits: false,

  loadLog: () =>
    whileCurrent(
      get,
      () => gitApi.getLog(LOG_PAGE_SIZE + 1, 0),
      page =>
        set({ commits: page.slice(0, LOG_PAGE_SIZE), hasMoreCommits: page.length > LOG_PAGE_SIZE }),
    ),

  loadHeadCommit: () => whileCurrent(get, gitApi.getHeadCommit, headCommit => set({ headCommit })),

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

  loadBranches: () =>
    whileCurrent(get, gitApi.getBranches, branches =>
      set({ branches, currentBranch: branches.find(b => b.current)?.name ?? '' }),
    ),

  loadStatus: () =>
    whileCurrent(
      get,
      () =>
        Promise.all([
          gitApi.getStatus(),
          gitApi.isMerging().catch(() => false),
          gitApi.isRebasing().catch(() => false),
        ]),
      ([result, merging, rebasing]) =>
        set({
          status: { staged: result.staged, unstaged: result.unstaged },
          aheadBehind: { ahead: result.ahead, behind: result.behind, upstream: result.upstream },
          merging,
          rebasing,
        }),
    ),

  loadStashes: async () => {
    if (!get().repoPath) return;
    await whileCurrent(get, gitApi.getStashList, stashes => set({ stashes }));
  },
});
