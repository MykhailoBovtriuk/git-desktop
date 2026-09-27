import type { RepoState } from './types';

/**
 * The host a sign-in could help with. A token only ever reaches an https
 * remote, so an ssh one — or no remote at all — gets no offer that could not
 * be kept.
 */
export const selectSignInHost = (s: Pick<RepoState, 'remoteHost' | 'remoteProtocol'>) =>
  s.remoteProtocol === 'https' ? s.remoteHost : null;
