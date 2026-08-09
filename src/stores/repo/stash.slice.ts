import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';

type StashSlice = Pick<RepoState, 'stashSave' | 'stashApply' | 'stashPop' | 'stashDrop'>;

export const createStashSlice: RepoSlice<StashSlice> = (_set, get) => ({
  stashSave: async (message, staged) =>
    get().runOperation('stash', async () => {
      await gitApi.stashSave(message, staged);
      await get().loadStashes();
      await get().loadStatus();
    }),

  stashApply: async index =>
    get().runOperation('stash', async () => {
      await gitApi.stashApply(index);
      await get().loadStatus();
    }),

  stashPop: async index =>
    get().runOperation('stash', async () => {
      await gitApi.stashPop(index);
      await get().loadStashes();
      await get().loadStatus();
    }),

  stashDrop: async index =>
    get().runOperation('stash', async () => {
      await gitApi.stashDrop(index);
      await get().loadStashes();
    }),
});
