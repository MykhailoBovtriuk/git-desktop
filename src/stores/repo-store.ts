import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getLocalStorage } from '../lib/storage';
import type { RepoState } from './repo/types';
import { createLifecycleSlice } from './repo/lifecycle.slice';
import { createLoadersSlice } from './repo/loaders.slice';
import { createStagingSlice } from './repo/staging.slice';
import { createRemoteSlice } from './repo/remote.slice';
import { createBranchesSlice } from './repo/branches.slice';
import { createCheckoutSlice } from './repo/checkout.slice';
import { createMergeSlice } from './repo/merge.slice';
import { createRebaseSlice } from './repo/rebase.slice';
import { createStashSlice } from './repo/stash.slice';

export { LOG_PAGE_SIZE } from './repo/types';
export { CheckoutConflictError } from './repo/checkout.slice';
export type { RepoState } from './repo/types';

export const useRepoStore = create<RepoState>()(
  persist(
    (set, get) => ({
      ...createLifecycleSlice(set, get),
      ...createLoadersSlice(set, get),
      ...createStagingSlice(set, get),
      ...createRemoteSlice(set, get),
      ...createBranchesSlice(set, get),
      ...createCheckoutSlice(set, get),
      ...createMergeSlice(set, get),
      ...createRebaseSlice(set, get),
      ...createStashSlice(set, get),
    }),
    {
      name: 'git-desktop-repo',
      storage: createJSONStorage(() => getLocalStorage()),
      partialize: s => ({ repoPath: s.repoPath, recentRepos: s.recentRepos }),
      onRehydrateStorage: () => state => {
        if (!state) return;
        state.recentRepos = (state.recentRepos ?? []).filter(Boolean);
        if (!state.repoPath) return;
        const path = state.repoPath;
        setTimeout(() => {
          useRepoStore
            .getState()
            .openRepo(path)
            .catch(() => {
              useRepoStore.setState({ repoPath: null });
            });
        }, 0);
      },
    },
  ),
);
