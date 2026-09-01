import { getJson, fetchAvatar } from '../http';
import type { FetchedAccount, ProviderDefinition } from './types';

interface GiteaUser {
  login: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

/**
 * Gitea and its fork Forgejo share an API, so one definition covers both —
 * and Codeberg, which is a hosted Forgejo. PKCE is supported, so no secret.
 */
export const gitea: ProviderDefinition = {
  id: 'gitea',
  displayName: 'Gitea / Forgejo',
  knownHosts: ['codeberg.org'],
  usesPkce: true,
  scopes: ['read:user', 'write:repository'],
  endpoints: host => ({
    authorizeUrl: `https://${host}/login/oauth/authorize`,
    tokenUrl: `https://${host}/login/oauth/access_token`,
    apiBase: `https://${host}/api/v1`,
  }),
  tokenHelpUrl: host => `https://${host}/user/settings/applications`,
  fetchAccount: async (host, token) => {
    const user = await getJson<GiteaUser>(`https://${host}/api/v1/user`, token);
    return {
      providerId: 'gitea',
      host,
      displayName: 'Gitea / Forgejo',
      login: user.login,
      name: user.full_name || null,
      email: user.email ?? '',
      avatarDataUrl: await fetchAvatar(user.avatar_url),
    } satisfies FetchedAccount;
  },
};
