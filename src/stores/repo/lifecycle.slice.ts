import { gitApi } from '../../api/git-api';
import { useAccountStore } from '../account-store';
import { useUiStore } from '../ui-store';
import type { RemoteProtocol } from '../../types';
import type { RepoState, RepoSlice } from './types';
import { whileCurrent } from './epoch';
import { mergeStateFrom } from './merge.slice';
import { errorMessage } from '../../lib/error-message';

type LifecycleSlice = Pick<
  RepoState,
  | 'epoch'
  | 'busyCount'
  | 'repoPath'
  | 'remoteUrl'
  | 'remoteHost'
  | 'remoteProtocol'
  | 'switchRemoteProtocol'
  | 'hasIdentity'
  | 'loadIdentity'
  | 'recentRepos'
  | 'lastRefreshError'
  | 'runOperation'
  | 'openRepo'
  | 'openDialog'
  | 'removeRecentRepo'
  | 'refresh'
>;

const NO_REPO = {
  repoPath: null,
  remoteUrl: null,
  remoteHost: null,
  remoteProtocol: null,
  mergeState: null,
} satisfies Partial<RepoState>;

// Coalesce concurrent refreshes: within one generation, all callers share the
// same round of loaders instead of firing duplicate IPC. Module-level because
// there is a single store instance.
let refreshInFlight: { epoch: number; promise: Promise<void> } | null = null;

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
  await account.refreshAuthSource(remoteHost, remoteProtocol, root);

  if (account.dismissedRepos.has(root)) return;
  if (account.phase) return;
  if (useAccountStore.getState().authSource !== 'none') return;
  await account.openSignIn(remoteHost, root);
}

export const createLifecycleSlice: RepoSlice<LifecycleSlice> = (set, get) => ({
  epoch: 0,
  busyCount: 0,
  repoPath: null,
  remoteUrl: null,
  remoteHost: null,
  remoteProtocol: null,
  hasIdentity: null,
  recentRepos: [],
  lastRefreshError: null,

  runOperation: async fn => {
    set(s => ({ busyCount: s.busyCount + 1, epoch: s.epoch + 1 }));
    try {
      return await fn();
    } finally {
      set(s => ({ busyCount: s.busyCount - 1, epoch: s.epoch + 1 }));
    }
  },

  switchRemoteProtocol: async to => {
    const { url, host, protocol } = await gitApi.switchRemoteProtocol(to);
    set(s => ({ epoch: s.epoch + 1, remoteUrl: url, remoteHost: host, remoteProtocol: protocol }));
    await useAccountStore.getState().refreshAuthSource(host, protocol, get().repoPath);
  },

  openRepo: async path => {
    const opened = await gitApi.openRepo(path);
    useUiStore.getState().closeOverlays();
    const root = opened?.root || path;
    set(s => ({
      ...NO_REPO,
      epoch: s.epoch + 1,
      repoPath: root,
      remoteUrl: opened?.remoteUrl ?? null,
      remoteHost: opened?.remoteHost ?? null,
      remoteProtocol: opened?.remoteProtocol ?? null,
      hasIdentity: null,
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
          set({ mergeState: mergeStateFrom(source, get().currentBranch, conflicts) });
        }
      } catch {}
    }
  },

  openDialog: async () => {
    const path = await gitApi.openDialog();
    if (path) await get().openRepo(path);
  },

  loadIdentity: () => whileCurrent(get, gitApi.hasIdentity, hasIdentity => set({ hasIdentity })),

  removeRecentRepo: path => {
    void gitApi.forgetRepo(path).catch(() => {});
    set(s => ({
      recentRepos: s.recentRepos.filter(r => r && r !== path),
      ...(s.repoPath === path ? { ...NO_REPO, epoch: s.epoch + 1 } : {}),
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
