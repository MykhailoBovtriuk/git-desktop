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
  // Never called: there is no API to ask, and the form already carries
  // everything an account needs. Throwing beats returning a hollow account
  // that would silently show up as a signed-in user with no name.
  fetchAccount: () =>
    Promise.reject(new Error('Token sign-in builds its account from the form, not from an API')),
};
