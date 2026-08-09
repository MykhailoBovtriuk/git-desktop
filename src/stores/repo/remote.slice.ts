import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';

type RemoteSlice = Pick<RepoState, 'fetch' | 'pull' | 'push' | 'publishBranch'>;

export const createRemoteSlice: RepoSlice<RemoteSlice> = (_set, get) => ({
  // Full refresh, not just ahead/behind: fetch brings new remote branches and
  // moves remote refs, which the branch list and log decorations must show.
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

  // Full refresh: push moves the remote ref, so the origin/<branch> badge in
  // the log must move too, not just the ahead/behind counters.
  push: async () =>
    get().runOperation('push', async () => {
      await gitApi.push();
      await get().refresh();
    }),

  // Publish the current branch: `git push -u origin <branch>`. Offered as a
  // follow-up action when a plain push fails for lack of an upstream.
  publishBranch: async () =>
    get().runOperation('push', async () => {
      const branch = get().currentBranch;
      if (!branch) throw new Error('No current branch to publish');
      await gitApi.pushSetUpstream('origin', branch);
      await get().refresh();
    }),
});
