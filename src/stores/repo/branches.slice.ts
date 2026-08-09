import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';

type BranchesSlice = Pick<RepoState, 'deleteBranch' | 'deleteRemoteBranch'>;

export const createBranchesSlice: RepoSlice<BranchesSlice> = (_set, get) => ({
  deleteBranch: async (branch, force) =>
    get().runOperation('deleteBranch', async () => {
      await gitApi.deleteBranch(branch, force);
      await get().loadBranches();
    }),

  deleteRemoteBranch: async (remote, branch) =>
    get().runOperation('deleteBranch', async () => {
      await gitApi.deleteRemoteBranch(remote, branch);
      await get().loadBranches();
    }),
});
