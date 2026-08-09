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

  // Stage a single hunk: apply its patch to the index. Wrapped in runOperation
  // so auto-refresh stands aside and the epoch bump makes the open diff
  // re-fetch (the working diff shrinks by exactly this hunk).
  stageHunk: async patch =>
    get().runOperation('stage', async () => {
      await gitApi.applyPatch(patch, { cached: true });
      await get().loadStatus();
    }),

  // Unstage a single hunk: apply the staged hunk's patch to the index in reverse.
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
