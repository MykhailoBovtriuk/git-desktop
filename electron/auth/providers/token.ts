import type { ProviderDefinition } from './types';

/**
 * The catch-all: any server nobody registered an OAuth app for.
 *
 * Bitbucket Server, AWS CodeCommit, Gerrit, a company's own GitLab behind a
 * VPN — no desktop client can hold credentials for all of them in advance, so
 * this one takes the username and token the user pastes and stores them by
 * exactly the same route as an OAuth result.
 *
 * The OAuth members are unreachable for this provider: `oauth-flow` never runs
 * for it. They exist so the registry can stay one homogeneous list.
 *
 * The credential is still checked before anything stores it — see
 * `verify-credential`, which proves it against the repository's own remote
 * rather than against an API this server may not have.
 */
export const tokenProvider: ProviderDefinition = {
  id: 'token',
  displayName: 'Personal access token',
  knownHosts: [],
  usesPkce: false,
  scopes: [],
  endpoints: host => ({
    authorizeUrl: '',
    tokenUrl: '',
    apiBase: `https://${host}`,
  }),
  tokenHelpUrl: host => `https://${host}`,
  // Never called: there is no API here to ask. `accountFromToken` routes this
  // provider through `verifyAgainstRemote` instead. Throwing beats returning a
  // hollow account that would show up as a signed-in user with no name.
  fetchAccount: () =>
    Promise.reject(new Error('Token sign-in builds its account from the form, not from an API')),
};
