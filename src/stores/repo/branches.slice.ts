import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';

type BranchesSlice = Pick<RepoState, 'createBranch' | 'deleteBranch' | 'deleteRemoteBranch'>;

export const createBranchesSlice: RepoSlice<BranchesSlice> = (_set, get) => ({
  createBranch: async (name, changes) =>
    get().runOperation('createBranch', async () => {
      // Order is the whole point: the new branch sits on the same commit, so a
      // stash taken afterwards would set the work aside on the new branch —
      // exactly the opposite of leaving it behind.
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
