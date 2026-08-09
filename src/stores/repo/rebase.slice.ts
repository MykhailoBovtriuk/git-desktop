import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';

type RebaseSlice = Pick<RepoState, 'rebase' | 'abortRebase' | 'continueRebase'>;

export const createRebaseSlice: RepoSlice<RebaseSlice> = (_set, get) => ({
  rebase: async branch =>
    get().runOperation('rebase', async () => {
      await gitApi.rebase(branch);
      await get().refresh();
    }),

  // Abort a conflicted rebase: `git rebase --abort` returns HEAD to where it
  // was before the rebase started. refresh() picks up the cleared rebasing flag.
  abortRebase: async () =>
    get().runOperation('rebase', async () => {
      await gitApi.abortRebase();
      await get().refresh();
    }),

  // Continue a rebase after conflicts are resolved & staged. If unresolved
  // conflicts remain, git-service rejects — the caller (useGitAction) surfaces it.
  continueRebase: async () =>
    get().runOperation('rebase', async () => {
      await gitApi.continueRebase();
      await get().refresh();
    }),
});
