import { getJson, fetchAvatar } from '../http';
import type { FetchedAccount, ProviderDefinition } from './types';

interface BitbucketUser {
  username: string;
  nickname: string | null;
  display_name: string | null;
  links?: { avatar?: { href?: string } };
}

interface BitbucketEmails {
  values: { email: string; is_primary: boolean; is_confirmed: boolean }[];
}

/**
 * Bitbucket Cloud. Two things make it the awkward one:
 *  - no PKCE for desktop consumers, so a secret is required;
 *  - access tokens live two hours, so the refresh path in the token store is
 *    not optional here the way it is for GitHub.
 */
export const bitbucket: ProviderDefinition = {
  id: 'bitbucket',
  displayName: 'Bitbucket',
  knownHosts: ['bitbucket.org', 'www.bitbucket.org'],
  usesPkce: false,
  // Bitbucket derives scopes from the consumer's configuration rather than the
  // request, so the authorize URL carries none.
  scopes: [],
  endpoints: () => ({
    authorizeUrl: 'https://bitbucket.org/site/oauth2/authorize',
    tokenUrl: 'https://bitbucket.org/site/oauth2/access_token',
    apiBase: 'https://api.bitbucket.org/2.0',
  }),
  tokenHelpUrl: () => 'https://bitbucket.org/account/settings/app-passwords/',
  fetchAccount: async (host, token) => {
    const user = await getJson<BitbucketUser>('https://api.bitbucket.org/2.0/user', token);
    const emails = await getJson<BitbucketEmails>(
      'https://api.bitbucket.org/2.0/user/emails',
      token,
    ).catch(() => ({ values: [] }) as BitbucketEmails);
    const primary =
      emails.values.find(e => e.is_primary && e.is_confirmed) ??
      emails.values.find(e => e.is_confirmed);
    return {
      providerId: 'bitbucket',
      host,
      displayName: 'Bitbucket',
      login: user.username || user.nickname || '',
      name: user.display_name,
      email: primary?.email ?? '',
      avatarDataUrl: await fetchAvatar(user.links?.avatar?.href),
    } satisfies FetchedAccount;
  },
};
