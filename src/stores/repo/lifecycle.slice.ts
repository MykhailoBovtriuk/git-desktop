import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';

type LifecycleSlice = Pick<
  RepoState,
  | 'epoch'
  | 'busyCount'
  | 'repoPath'
  | 'recentRepos'
  | 'busyOperation'
  | 'lastRefreshError'
  | 'runOperation'
  | 'openRepo'
  | 'openDialog'
  | 'refresh'
>;

// Coalesce concurrent refreshes: within one generation, all callers share the
// same round of loaders instead of firing duplicate IPC. Module-level because
// there is a single store instance (equivalent to the former closure var).
let refreshInFlight: { epoch: number; promise: Promise<void> } | null = null;

export const createLifecycleSlice: RepoSlice<LifecycleSlice> = (set, get) => ({
  epoch: 0,
  busyCount: 0,
  repoPath: null,
  recentRepos: [],
  busyOperation: null,
  lastRefreshError: null,

  runOperation: async (name, fn) => {
    set(s => ({ busyCount: s.busyCount + 1, busyOperation: name, epoch: s.epoch + 1 }));
    try {
      return await fn();
    } finally {
      set(s => {
        const busyCount = s.busyCount - 1;
        return {
          busyCount,
          busyOperation: busyCount === 0 ? null : s.busyOperation,
          epoch: s.epoch + 1,
        };
      });
    }
  },

  openRepo: async path => {
    const root = (await gitApi.openRepo(path)) || path;
    set(s => ({
      epoch: s.epoch + 1,
      repoPath: root,
      mergeState: null,
      recentRepos: [root, ...s.recentRepos.filter(r => r && r !== root)].slice(0, 10),
    }));
    await get().refresh();
    if (get().merging && !get().mergeState) {
      try {
        const conflicts = await gitApi.getMergeConflicts();
        if (conflicts.length > 0) {
          const msg = await gitApi.getMergeMessage().catch(() => '');
          const source = /Merge branch '([^']+)'/.exec(msg)?.[1] ?? '';
          set({
            mergeState: {
              sourceBranch: source,
              targetBranch: get().currentBranch,
              conflictingFiles: conflicts,
            },
          });
        }
      } catch {}
    }
  },

  openDialog: async () => {
    const path = await gitApi.openDialog();
    if (path) await get().openRepo(path);
  },

  refresh: async () => {
    const epoch = get().epoch;
    if (refreshInFlight && refreshInFlight.epoch === epoch) {
      return refreshInFlight.promise;
    }
    const promise = (async () => {
      const results = await Promise.allSettled([
        get().loadLog(),
        get().loadBranches(),
        get().loadStatus(),
        get().loadStashes(),
      ]);
      if (get().epoch !== epoch) return;
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => (r.reason instanceof Error ? r.reason.message : String(r.reason)));
      set({ lastRefreshError: errors.length ? errors.join('; ') : null });
    })();
    refreshInFlight = { epoch, promise };
    try {
      await promise;
    } finally {
      if (refreshInFlight?.promise === promise) refreshInFlight = null;
    }
  },
});
