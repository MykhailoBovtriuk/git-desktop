import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';

export const mergeStateFrom = (
  sourceBranch: string,
  targetBranch: string,
  conflictingFiles: string[],
): NonNullable<RepoState['mergeState']> => ({ sourceBranch, targetBranch, conflictingFiles });

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
    get().runOperation(async () => {
      const result = await gitApi.merge(branch);
      if (result.conflicts.length > 0) {
        set({ mergeState: mergeStateFrom(branch, get().currentBranch, result.conflicts) });
        throw new MergeConflictError();
      }
      set({ mergeState: null });
      await get().refresh();
    }),

  abortMerge: async () =>
    get().runOperation(async () => {
      await gitApi.abortMerge();
      set({ mergeState: null });
      await get().refresh();
    }),

  clearMergeState: () => set({ mergeState: null }),

  concludeMerge: async () =>
    get().runOperation(async () => {
      await gitApi.concludeMerge();
      set({ mergeState: null });
      await get().refresh();
    }),
});
