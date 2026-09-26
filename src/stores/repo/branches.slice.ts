import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';

type BranchesSlice = Pick<RepoState, 'createBranch' | 'deleteBranch' | 'deleteRemoteBranch'>;

export const createBranchesSlice: RepoSlice<BranchesSlice> = (_set, get) => ({
  createBranch: async (name, changes) =>
    get().runOperation('createBranch', async () => {
      // Stash before switching: the new branch shares the commit, so stashing
      // afterwards would park the work on it.
      if (changes === 'leave') {
        await gitApi.stashSave(`WIP on ${get().currentBranch}`, false, true);
      }
      await gitApi.createBranch(name);
      await get().refresh();
    }),

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
