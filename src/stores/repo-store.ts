import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { gitApi } from '../api/git-api';
import type { Commit, Branch, GitStatus, AheadBehind, MergeState, StashEntry } from '../types';

export class CheckoutConflictError extends Error {
  constructor() {
    super('checkout blocked: local changes would be overwritten');
    this.name = 'CheckoutConflictError';
  }
}

interface RepoState {
  repoPath: string | null;
  recentRepos: string[];
  commits: Commit[];
  branches: Branch[];
  currentBranch: string;
  status: GitStatus;
  aheadBehind: AheadBehind;
  mergeState: MergeState | null;
  checkoutConflict: { branch: string } | null;
  stashes: StashEntry[];
  loadStashes: () => Promise<void>;
  stashSave: (message?: string) => Promise<void>;
  stashApply: (index: number) => Promise<void>;
  stashPop: (index: number) => Promise<void>;
  stashDrop: (index: number) => Promise<void>;
  openRepo: (path: string) => Promise<void>;
  openDialog: () => Promise<void>;
  loadLog: () => Promise<void>;
  loadBranches: () => Promise<void>;
  loadStatus: () => Promise<void>;
  loadAheadBehind: () => Promise<void>;
  refresh: () => Promise<void>;
  stageFiles: (paths: string[]) => Promise<void>;
  unstageFiles: (paths: string[]) => Promise<void>;
  discardChanges: (paths: string[]) => Promise<void>;
  commit: (message: string) => Promise<void>;
  fetch: () => Promise<void>;
  pull: () => Promise<string>;
  push: () => Promise<void>;
  checkout: (branch: string) => Promise<void>;
  stashAndCheckout: () => Promise<void>;
  migrateCheckout: () => Promise<void>;
  forceCheckout: () => Promise<void>;
  cancelCheckout: () => void;
  merge: (branch: string) => Promise<void>;
  rebase: (branch: string) => Promise<void>;
  deleteBranch: (branch: string) => Promise<void>;
  abortMerge: () => Promise<void>;
}

export const useRepoStore = create<RepoState>()(
  persist(
    (set, get) => ({
  repoPath: null,
  recentRepos: [],
  commits: [],
  branches: [],
  currentBranch: '',
  status: { staged: [], unstaged: [] },
  aheadBehind: { ahead: 0, behind: 0 },
  mergeState: null,
  checkoutConflict: null,
  stashes: [],

  openRepo: async (path) => {
    await gitApi.openRepo(path);
    set(s => ({
      repoPath: path,
      recentRepos: s.recentRepos.includes(path)
        ? s.recentRepos
        : [path, ...s.recentRepos].slice(0, 10),
    }));
    await get().refresh();
  },

  openDialog: async () => {
    const path = await gitApi.openDialog();
    if (path) await get().openRepo(path);
  },

  loadLog: async () => {
    const commits = await gitApi.getLog(200, 0);
    set({ commits });
  },

  loadBranches: async () => {
    const branches = await gitApi.getBranches();
    const current = branches.find(b => b.current);
    set({ branches, currentBranch: current?.name ?? '' });
  },

  loadStatus: async () => {
    const result = await gitApi.getStatus();
    set({ status: { staged: result.staged, unstaged: result.unstaged }, aheadBehind: { ahead: result.ahead, behind: result.behind } });
  },

  loadAheadBehind: async () => {
    await get().loadStatus();
  },

  refresh: async () => {
    await Promise.all([
      get().loadLog(),
      get().loadBranches(),
      get().loadStatus(),
      get().loadStashes(),
    ]);
  },

  stageFiles: async (paths) => {
    await gitApi.stageFiles(paths);
    await get().loadStatus();
  },

  unstageFiles: async (paths) => {
    await gitApi.unstageFiles(paths);
    await get().loadStatus();
  },

  discardChanges: async (paths) => {
    await gitApi.discardChanges(paths);
    await get().loadStatus();
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

  stashSave: async (message) => {
    await gitApi.stashSave(message);
    await get().loadStashes();
    await get().loadStatus();
  },

  stashApply: async (index) => {
    await gitApi.stashApply(index);
    await get().loadStatus();
  },

  stashPop: async (index) => {
    await gitApi.stashPop(index);
    await get().loadStashes();
    await get().loadStatus();
  },

  stashDrop: async (index) => {
    await gitApi.stashDrop(index);
    await get().loadStashes();
  },

  commit: async (message) => {
    await gitApi.commit(message);
    await get().refresh();
  },

  fetch: async () => {
    await gitApi.fetch();
    await get().loadAheadBehind();
  },

  pull: async () => {
    const result = await gitApi.pull();
    await get().refresh();
    return result;
  },

  push: async () => {
    await gitApi.push();
    await get().loadAheadBehind();
  },

  checkout: async (branch) => {
    const known = get().branches.find(b => b.name === branch);
    const target = known?.remote ? branch.replace(/^[^/]+\//, '') : branch;
    try {
      await gitApi.checkout(target);
      await get().refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // git aborts the checkout when uncommitted changes would be clobbered.
      // Surface a modal (via checkoutConflict) instead of a raw error toast.
      if (/overwritten by checkout|commit your changes or stash/i.test(msg)) {
        set({ checkoutConflict: { branch: target } });
        throw new CheckoutConflictError();
      }
      throw err;
    }
  },

  // Set the blocked changes aside in a stash, then switch. Changes stay in the
  // stash (recoverable with stash pop later).
  stashAndCheckout: async () => {
    const conflict = get().checkoutConflict;
    if (!conflict) return;
    set({ checkoutConflict: null });
    await gitApi.stashSave(`WIP before switching to ${conflict.branch}`);
    await gitApi.checkout(conflict.branch);
    await get().refresh();
  },

  // Carry the blocked changes over to the target branch (stash → switch → pop).
  migrateCheckout: async () => {
    const conflict = get().checkoutConflict;
    if (!conflict) return;
    set({ checkoutConflict: null });
    await gitApi.stashSave(`Migrating changes to ${conflict.branch}`);
    await gitApi.checkout(conflict.branch);
    await gitApi.stashPop(0);
    await get().refresh();
  },

  // Discard the blocked changes and switch anyway.
  forceCheckout: async () => {
    const conflict = get().checkoutConflict;
    if (!conflict) return;
    set({ checkoutConflict: null });
    await gitApi.checkoutForce(conflict.branch);
    await get().refresh();
  },

  cancelCheckout: () => set({ checkoutConflict: null }),

  merge: async (branch) => {
    const result = await gitApi.merge(branch);
    if (result.conflicts.length > 0) {
      set({
        mergeState: {
          sourceBranch: branch,
          targetBranch: get().currentBranch,
          conflictingFiles: result.conflicts,
        },
      });
    } else {
      set({ mergeState: null });
      await get().refresh();
    }
  },

  rebase: async (branch) => {
    await gitApi.rebase(branch);
    await get().refresh();
  },

  deleteBranch: async (branch) => {
    await gitApi.deleteBranch(branch);
    await get().loadBranches();
  },

  abortMerge: async () => {
    await gitApi.abortMerge();
    set({ mergeState: null });
    await get().refresh();
  },
    }),
    {
      name: 'git-desktop-repo',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ repoPath: s.repoPath, recentRepos: s.recentRepos }),
      // Once the persisted repoPath is restored — on a fresh launch and after a
      // dev hot-reload — re-open it so branches/status/stashes are repopulated.
      // Without this the UI shows an empty "no branch" until the next action.
      // Deferred to a macrotask so `useRepoStore` is assigned before we use it
      // (localStorage rehydrates synchronously, during store creation).
      onRehydrateStorage: () => (state) => {
        if (!state?.repoPath) return;
        const path = state.repoPath;
        setTimeout(() => {
          useRepoStore.getState().openRepo(path).catch(() => {
            useRepoStore.setState({ repoPath: null });
          });
        }, 0);
      },
    },
  ),
);
