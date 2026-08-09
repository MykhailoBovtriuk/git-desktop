import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';

type RebaseSlice = Pick<RepoState, 'rebase' | 'abortRebase' | 'continueRebase'>;

export const createRebaseSlice: RepoSlice<RebaseSlice> = (_set, get) => ({
  rebase: async branch =>
    get().runOperation('rebase', async () => {
      await gitApi.rebase(branch);
      await get().refresh();
    }),

  abortRebase: async () =>
    get().runOperation('rebase', async () => {
      await gitApi.abortRebase();
      await get().refresh();
    }),

  continueRebase: async () =>
    get().runOperation('rebase', async () => {
      await gitApi.continueRebase();
      await get().refresh();
    }),
});
