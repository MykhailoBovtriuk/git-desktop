import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';

type StagingSlice = Pick<
  RepoState,
  'stageFiles' | 'unstageFiles' | 'stageHunk' | 'unstageHunk' | 'discardChanges' | 'commit'
>;

export const createStagingSlice: RepoSlice<StagingSlice> = (_set, get) => ({
  stageFiles: async paths => {
    await gitApi.stageFiles(paths);
    await get().loadStatus();
  },

  unstageFiles: async paths => {
    await gitApi.unstageFiles(paths);
    await get().loadStatus();
  },

  stageHunk: async patch =>
    get().runOperation('stage', async () => {
      await gitApi.applyPatch(patch, { cached: true });
      await get().loadStatus();
    }),

  unstageHunk: async patch =>
    get().runOperation('unstage', async () => {
      await gitApi.applyPatch(patch, { cached: true, reverse: true });
      await get().loadStatus();
    }),

  discardChanges: async paths => {
    await gitApi.discardChanges(paths);
    await get().loadStatus();
  },

  commit: async message =>
    get().runOperation('commit', async () => {
      await gitApi.commit(message);
      await get().refresh();
    }),
});
