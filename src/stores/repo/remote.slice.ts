import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';

type RemoteSlice = Pick<RepoState, 'fetch' | 'pull' | 'push' | 'publishBranch'>;

export const createRemoteSlice: RepoSlice<RemoteSlice> = (_set, get) => ({
  fetch: async () =>
    get().runOperation('fetch', async () => {
      await gitApi.fetch();
      await get().refresh();
    }),

  pull: async () =>
    get().runOperation('pull', async () => {
      const result = await gitApi.pull();
      await get().refresh();
      return result;
    }),

  push: async () =>
    get().runOperation('push', async () => {
      await gitApi.push();
      await get().refresh();
    }),

  publishBranch: async () =>
    get().runOperation('push', async () => {
      const branch = get().currentBranch;
      if (!branch) throw new Error('No current branch to publish');
      await gitApi.pushSetUpstream('origin', branch);
      await get().refresh();
    }),
});
