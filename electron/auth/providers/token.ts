import type { ProviderDefinition } from './types';

export const tokenProvider: ProviderDefinition = {
  id: 'token',
  displayName: 'Personal access token',
  group: 'other',
  knownHosts: [],
  usesPkce: false,
  scopes: [],
  endpoints: host => ({
    authorizeUrl: '',
    tokenUrl: '',
    apiBase: `https://${host}`,
  }),
  tokenHelpUrl: host => `https://${host}`,
  fetchAccount: () =>
    Promise.reject(new Error('Token sign-in builds its account from the form, not from an API')),
};
