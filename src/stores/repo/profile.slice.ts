import { gitApi } from '../../api/git-api';
import type { GitProfile } from '../../types';
import type { RepoState, RepoSlice } from './types';

type ProfileSlice = Pick<RepoState, 'identity' | 'loadIdentity' | 'applyProfile' | 'clearProfile'>;

export const createProfileSlice: RepoSlice<ProfileSlice> = (set, get) => ({
  identity: null,

  loadIdentity: async () => {
    const startedEpoch = get().epoch;
    const identity = await gitApi.getIdentity();
    if (get().epoch !== startedEpoch) return;
    set({ identity });
  },

  applyProfile: async (profile: GitProfile) => {
    const identity = await gitApi.applyProfile(profile);
    set({ identity });
  },

  clearProfile: async () => {
    const identity = await gitApi.clearProfile();
    set({ identity });
  },
});
