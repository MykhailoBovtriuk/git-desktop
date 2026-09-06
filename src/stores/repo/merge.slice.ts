import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';

/**
 * Thrown when a merge stops on conflicts. Same pattern as
 * CheckoutConflictError: the conflict modal is already on screen, so callers
 * must treat this as "handled elsewhere" — not as success, which put a green
 * "Merged" toast next to a red "Merge Conflict" dialog.
 */
export class MergeConflictError extends Error {
  constructor() {
    super('Merge stopped on conflicts');
    this.name = 'MergeConflictError';
  }
}

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
        throw new MergeConflictError();
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
