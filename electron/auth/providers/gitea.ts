import { getJson, fetchAvatar, probe } from '../http';
import type { FetchedAccount, ProviderDefinition } from './types';

interface GiteaUser {
  login: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export const gitea: ProviderDefinition = {
  id: 'gitea',
  displayName: 'Gitea / Forgejo',
  group: 'other',
  knownHosts: ['codeberg.org'],
  usesPkce: true,
  scopes: ['read:user', 'write:repository'],
  endpoints: host => ({
    authorizeUrl: `https://${host}/login/oauth/authorize`,
    tokenUrl: `https://${host}/login/oauth/access_token`,
    apiBase: `https://${host}/api/v1`,
  }),
  tokenHelpUrl: host => `https://${host}/user/settings/applications`,
  probe: async host => {
    const res = await probe(`https://${host}/api/v1/version`);
    if (!res) return 'unreachable';
    const body = res.body as { version?: unknown } | null;
    return res.status === 200 && typeof body?.version === 'string' ? 'ok' : 'mismatch';
  },
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
