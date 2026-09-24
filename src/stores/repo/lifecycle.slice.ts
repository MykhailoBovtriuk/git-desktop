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
// there is a single store instance (equivalent to the former closure var).
let refreshInFlight: { epoch: number; promise: Promise<void> } | null = null;

/**
 * Offer to sign in the moment a repository that needs it is opened.
 *
 * This is the only place the prompt appears on its own: the alternative is
 * letting the user work for a while and meet the question as a failed push,
 * which is the dead end this whole feature exists to remove. Dismissing it is
 * remembered for the session, so re-opening the same repo does not nag.
 *
 * What authenticates the remote is asked of the main process, not assumed —
 * an ssh remote, an account already signed in, or a credential git can already
 * read on its own all make the offer pointless, and offering anyway is what
 * made this feature feel like it existed for its own sake.
 *
 * The answer is fetched even for the cases that will not prompt: the footer
 * shows what *is* authenticating the remote, and that needs the ssh and
 * system-keychain answers just as much as the empty one.
 */
async function promptSignInIfNeeded(
  root: string,
  remoteHost: string | null,
  remoteProtocol: RemoteProtocol | null,
): Promise<void> {
  if (!remoteHost) return;

  // Wait for the account list rather than skipping when it is not in yet. On
  // startup the store rehydrates and reopens the last repository immediately,
  // which is well before the first `account:list` returns — bailing out here
  // meant the prompt never appeared for the repo the user already had open,
  // i.e. on every launch.
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
