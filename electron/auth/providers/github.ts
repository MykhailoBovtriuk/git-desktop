import type { ProviderId } from '../../../src/types';
import { getJson, fetchAvatar } from '../http';
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

/**
 * GitHub.com and GitHub Enterprise Server differ only in where the API lives,
 * so they share every line below and differ by two functions passed in.
 */
export function makeGitHubProvider(opts: {
  id: ProviderId;
  displayName: string;
  knownHosts: string[];
  webBase: (host: string) => string;
  apiBase: (host: string) => string;
}): ProviderDefinition {
  return {
    id: opts.id,
    displayName: opts.displayName,
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

/**
 * The email to commit as.
 *
 * A user who hid their address has no public email, and committing with a
 * blank one is rejected by git. GitHub's own noreply form is the documented
 * substitute and is what GitHub Desktop writes in the same situation.
 */
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
  knownHosts: ['github.com', 'www.github.com'],
  webBase: () => 'https://github.com',
  apiBase: () => 'https://api.github.com',
});

/**
 * GitHub Enterprise Server. The API sits under /api/v3 on the same host rather
 * than on a separate api. subdomain, which is the one thing that differs.
 */
export const githubEnterprise = makeGitHubProvider({
  id: 'github-enterprise',
  displayName: 'GitHub Enterprise',
  knownHosts: [],
  webBase: host => `https://${host}`,
  apiBase: host => `https://${host}/api/v3`,
});
