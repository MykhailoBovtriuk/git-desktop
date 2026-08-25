import { gitApi } from '../../api/git-api';
import type { RepoState, RepoSlice } from './types';

type IdentitySlice = Pick<
  RepoState,
  'identity' | 'loadIdentity' | 'setIdentity' | 'setGlobalIdentity' | 'clearIdentity'
>;

export const createIdentitySlice: RepoSlice<IdentitySlice> = (set, get) => ({
  identity: null,

  loadIdentity: async () => {
    const startedEpoch = get().epoch;
    const identity = await gitApi.getIdentity();
    if (get().epoch !== startedEpoch) return;
    set({ identity });
  },

  setIdentity: async (name: string, email: string) => {
    set({ identity: await gitApi.setIdentity(name, email) });
  },

  setGlobalIdentity: async (name: string, email: string) => {
    set({ identity: await gitApi.setGlobalIdentity(name, email) });
  },

  clearIdentity: async () => {
    set({ identity: await gitApi.clearIdentity() });
  },
});
