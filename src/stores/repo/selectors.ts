import type { RepoState } from './types';

export const selectSignInHost = (s: Pick<RepoState, 'remoteHost' | 'remoteProtocol'>) =>
  s.remoteProtocol === 'https' ? s.remoteHost : null;
