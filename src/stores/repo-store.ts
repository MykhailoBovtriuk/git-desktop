import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { gitApi } from '../api/git-api';
import type { Commit, Branch, GitStatus, AheadBehind, MergeState } from '../types';

interface RepoState {
  repoPath: string | null;
  recentRepos: string[];
  commits: Commit[];
  branches: Branch[];
  currentBranch: string;
  status: GitStatus;
  aheadBehind: AheadBehind;
  mergeState: MergeState | null;
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
    await gitApi.checkout(branch);
    await get().refresh();
  },

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
    },
  ),
);
