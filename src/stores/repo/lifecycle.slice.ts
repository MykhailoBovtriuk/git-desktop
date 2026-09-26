import { gitApi } from '../../api/git-api';
import { useAccountStore } from '../account-store';
import type { RemoteProtocol } from '../../types';
import type { RepoState, RepoSlice } from './types';
import { errorMessage } from '../../lib/error-message';

type LifecycleSlice = Pick<
  RepoState,
  | 'epoch'
  | 'busyCount'
  | 'repoPath'
  | 'remoteHost'
  | 'remoteProtocol'
  | 'hasIdentity'
  | 'loadIdentity'
  | 'recentRepos'
  | 'busyOperation'
  | 'lastRefreshError'
  | 'runOperation'
  | 'openRepo'
  | 'openDialog'
  | 'removeRecentRepo'
  | 'refresh'
>;

// Coalesce concurrent refreshes: within one generation, all callers share the
// same round of loaders instead of firing duplicate IPC. Module-level because
// there is a single store instance.
let refreshInFlight: { epoch: number; promise: Promise<void> } | null = null;

/**
 * Offer to sign in when a repository that needs it opens, unless it is ssh,
 * already signed in or covered by git. The answer also feeds the footer.
 */
async function promptSignInIfNeeded(
  root: string,
  remoteHost: string | null,
  remoteProtocol: RemoteProtocol | null,
): Promise<void> {
  if (!remoteHost) return;

  // Wait for the account list: at startup the last repository reopens before it
  // arrives, so skipping would lose the prompt.
  if (!useAccountStore.getState().loaded) {
    await useAccountStore
      .getState()
      .loadAccounts()
      .catch(() => {});
  }

  const account = useAccountStore.getState();
  account.refreshCurrent(remoteHost);
  await account.refreshAuthSource(remoteHost, remoteProtocol);

  if (account.dismissedRepos.has(root)) return;
  if (account.phase) return;
  if (useAccountStore.getState().authSource !== 'none') return;
  await account.openSignIn(remoteHost, root);
}

export const createLifecycleSlice: RepoSlice<LifecycleSlice> = (set, get) => ({
  epoch: 0,
  busyCount: 0,
  repoPath: null,
  remoteHost: null,
  remoteProtocol: null,
  hasIdentity: null,
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
    const opened = await gitApi.openRepo(path);
    const root = opened?.root || path;
    set(s => ({
      epoch: s.epoch + 1,
      repoPath: root,
      remoteHost: opened?.remoteHost ?? null,
      remoteProtocol: opened?.remoteProtocol ?? null,
      hasIdentity: null,
      mergeState: null,
      recentRepos: [root, ...s.recentRepos.filter(r => r && r !== root)].slice(0, 10),
    }));
    await get().refresh();
    void promptSignInIfNeeded(root, opened?.remoteHost ?? null, opened?.remoteProtocol ?? null);
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

  loadIdentity: async () => {
    const startedEpoch = get().epoch;
    const hasIdentity = await gitApi.hasIdentity();
    if (get().epoch !== startedEpoch) return;
    set({ hasIdentity });
  },

  removeRecentRepo: path => {
    set(s => ({
      recentRepos: s.recentRepos.filter(r => r && r !== path),
      // Dropping the repo that is currently open leaves nothing to show, so
      // close it too — Shell falls back to the welcome screen on a null path.
      ...(s.repoPath === path
        ? {
            repoPath: null,
            remoteHost: null,
            remoteProtocol: null,
            mergeState: null,
            epoch: s.epoch + 1,
          }
        : {}),
    }));
  },

  refresh: async () => {
    const epoch = get().epoch;
    if (refreshInFlight && refreshInFlight.epoch === epoch) {
      return refreshInFlight.promise;
    }
    const promise = (async () => {
      const results = await Promise.allSettled([
        get().loadLog(),
        get().loadHeadCommit(),
        get().loadBranches(),
        get().loadStatus(),
        get().loadStashes(),
        get().loadIdentity(),
      ]);
      if (get().epoch !== epoch) return;
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => errorMessage(r.reason));
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
