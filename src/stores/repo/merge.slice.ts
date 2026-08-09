import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';

type MergeSlice = Pick<
  RepoState,
  'mergeState' | 'merge' | 'abortMerge' | 'clearMergeState' | 'concludeMerge'
>;

export const createMergeSlice: RepoSlice<MergeSlice> = (set, get) => ({
  mergeState: null,

  merge: async branch =>
    get().runOperation('merge', async () => {
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
    }),

  abortMerge: async () =>
    get().runOperation('merge', async () => {
      await gitApi.abortMerge();
      set({ mergeState: null });
      await get().refresh();
    }),

  clearMergeState: () => set({ mergeState: null }),

  concludeMerge: async () =>
    get().runOperation('merge', async () => {
      await gitApi.concludeMerge();
      set({ mergeState: null });
      await get().refresh();
    }),
});
