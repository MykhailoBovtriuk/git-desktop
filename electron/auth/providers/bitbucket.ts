import { authedGet, getJson, fetchAvatar, probe } from '../http';
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
 * Bitbucket Cloud: no PKCE for desktop consumers, so a secret is required;
 * tokens live two hours, so refresh is mandatory.
 */
export const bitbucket: ProviderDefinition = {
  id: 'bitbucket',
  displayName: 'Bitbucket',
  group: 'other',
  knownHosts: ['bitbucket.org', 'www.bitbucket.org'],
  usesPkce: false,
  // Bitbucket derives scopes from the consumer's configuration rather than the
  // request, so the authorize URL carries none.
  scopes: [],
  endpoints: () => ({
    authorizeUrl: 'https://bitbucket.org/site/oauth2/authorize',
    tokenUrl: 'https://bitbucket.org/site/oauth2/access_token',
  }),
  // App passwords stop working for git on 9 June 2026; API tokens replace them.
  tokenHelpUrl: () => 'https://id.atlassian.com/manage-profile/security/api-tokens',
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

interface BitbucketServerUser {
  name: string;
  slug: string;
  displayName: string | null;
  emailAddress: string | null;
}

/**
 * Bitbucket Data Center, on the user's own server. OAuth 2.0 needs an
 * incoming application link the user creates, with PKCE; an HTTP access token
 * is the usual way in. Git takes it with the user slug as the username.
 */
export const bitbucketServer: ProviderDefinition = {
  id: 'bitbucket-server',
  displayName: 'Bitbucket Data Center',
  group: 'other',
  knownHosts: [],
  usesPkce: true,
  scopes: ['REPO_WRITE'],
  endpoints: host => ({
    authorizeUrl: `https://${host}/rest/oauth2/latest/authorize`,
    tokenUrl: `https://${host}/rest/oauth2/latest/token`,
  }),
  tokenHelpUrl: host => `https://${host}/plugins/servlet/access-tokens/manage`,
  probe: async host => {
    const res = await probe(`https://${host}/rest/api/1.0/application-properties`);
    if (!res) return 'unreachable';
    const body = res.body as { displayName?: unknown } | null;
    return res.status === 200 && body?.displayName === 'Bitbucket' ? 'ok' : 'mismatch';
  },
  fetchAccount: async (host, token) => {
    // The REST API has no "current user" endpoint, but every authenticated
    // REST answer names the user in X-AUSERNAME. (Access tokens are only
    // honoured on REST and git URLs, so no servlet is asked.)
    const res = await authedGet(
      `https://${host}/rest/api/1.0/application-properties`,
      `Bearer ${token}`,
    );
    const name = res.headers.get('x-ausername')?.trim();
    if (!name) throw new Error(`https://${host} returned 401 for this token`);
    const user = await getJson<BitbucketServerUser>(
      `https://${host}/rest/api/1.0/users/${encodeURIComponent(name)}`,
      token,
    );
    return {
      providerId: 'bitbucket-server',
      host,
      displayName: 'Bitbucket Data Center',
      login: user.slug || user.name,
      name: user.displayName,
      email: user.emailAddress ?? '',
      avatarDataUrl: null,
    } satisfies FetchedAccount;
  },
};
