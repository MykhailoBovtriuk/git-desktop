import type { ProviderDefinition } from './types';

/**
 * The catch-all for servers without an OAuth app: a pasted username and token,
 * checked against the remote by `verify-credential` before it is stored.
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
  // Never called: `accountFromToken` routes this provider through
  // `verifyAgainstRemote`.
  fetchAccount: () =>
    Promise.reject(new Error('Token sign-in builds its account from the form, not from an API')),
};
