import type { AccountGroup, ProviderId, ServerProbe } from '../../../src/types';
import { getJson, fetchAvatar, probe, sendRevoke } from '../http';
import type { FetchedAccount, ProviderDefinition } from './types';

interface GitHubUser {
  login: string;
  id: number;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

const ACCEPT = 'application/vnd.github+json';

export function makeGitHubProvider(opts: {
  id: ProviderId;
  displayName: string;
  group: AccountGroup;
  knownHosts: string[];
  webBase: (host: string) => string;
  apiBase: (host: string) => string;
}): ProviderDefinition {
  return {
    id: opts.id,
    displayName: opts.displayName,
    group: opts.group,
    knownHosts: opts.knownHosts,
    // GitHub's web flow has no PKCE for desktop clients — hence the secret.
    usesPkce: false,
    scopes: ['repo', 'user', 'workflow'],
    endpoints: host => ({
      authorizeUrl: `${opts.webBase(host)}/login/oauth/authorize`,
      tokenUrl: `${opts.webBase(host)}/login/oauth/access_token`,
      apiBase: opts.apiBase(host),
    }),
    tokenHelpUrl: host => `${opts.webBase(host)}/settings/tokens`,
    revokeToken: async ({ host, token, clientId, clientSecret }) => {
      if (!clientId || !clientSecret) return;
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      await sendRevoke(`${opts.apiBase(host)}/applications/${clientId}/token`, {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${basic}`,
          Accept: ACCEPT,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_token: token }),
      });
    },
    fetchAccount: async (host, token) => {
      const api = opts.apiBase(host);
      const user = await getJson<GitHubUser>(`${api}/user`, token, ACCEPT);
      return {
        providerId: opts.id,
        host,
        displayName: opts.displayName,
        login: user.login,
        name: user.name,
        email: await resolveEmail(api, token, user),
        avatarDataUrl: await fetchAvatar(user.avatar_url),
      } satisfies FetchedAccount;
    },
  };
}

async function resolveEmail(api: string, token: string, user: GitHubUser): Promise<string> {
  const emails = await getJson<GitHubEmail[]>(`${api}/user/emails`, token, ACCEPT).catch(
    () => [] as GitHubEmail[],
  );
  const primary = emails.find(e => e.primary && e.verified) ?? emails.find(e => e.verified);
  return primary?.email ?? user.email ?? `${user.id}+${user.login}@users.noreply.github.com`;
}

export const github = makeGitHubProvider({
  id: 'github',
  displayName: 'GitHub',
  group: 'github',
  knownHosts: ['github.com', 'www.github.com'],
  webBase: () => 'https://github.com',
  apiBase: () => 'https://api.github.com',
});

/**
 * GitHub Enterprise Cloud with data residency lives on a `*.ghe.com` subdomain
 * and, like github.com, keeps its API on an `api.` host of its own.
 */
const isGheCom = (host: string) => host.endsWith('.ghe.com');

export const githubEnterprise = {
  ...makeGitHubProvider({
    id: 'github-enterprise',
    displayName: 'GitHub Enterprise',
    group: 'github-enterprise',
    knownHosts: [],
    webBase: host => `https://${host}`,
    apiBase: host => (isGheCom(host) ? `https://api.${host}` : `https://${host}/api/v3`),
  }),
  probe: async (host: string): Promise<ServerProbe> => {
    const api = isGheCom(host) ? `https://api.${host}` : `https://${host}/api/v3`;
    const res = await probe(`${api}/meta`);
    if (!res) return 'unreachable';
    // Every GitHub API response carries a request id; Server adds its version.
    // A private-mode instance answers 401 to anonymous calls, with both.
    const github =
      res.headers.has('x-github-enterprise-version') || res.headers.has('x-github-request-id');
    return github && (res.status === 200 || res.status === 401) ? 'ok' : 'mismatch';
  },
};
