import type { AccountGroup, ProviderId } from '../../../src/types';
import { getJson, fetchAvatar, probe, sendRevoke } from '../http';
import type { FetchedAccount, ProviderDefinition } from './types';

interface GitLabUser {
  username: string;
  name: string | null;
  email: string | null;
  commit_email: string | null;
  public_email: string | null;
  avatar_url: string | null;
}

function makeGitLabProvider(
  id: ProviderId,
  displayName: string,
  group: AccountGroup,
  knownHosts: string[],
): ProviderDefinition {
  return {
    id,
    displayName,
    group,
    knownHosts,
    usesPkce: true,
    // `write_repository` is what push needs; `api` alone does not cover git-over-HTTP.
    scopes: ['api', 'read_user', 'write_repository'],
    endpoints: host => ({
      authorizeUrl: `https://${host}/oauth/authorize`,
      tokenUrl: `https://${host}/oauth/token`,
      apiBase: `https://${host}/api/v4`,
    }),
    tokenHelpUrl: host => `https://${host}/-/user_settings/personal_access_tokens`,
    probe: async host => {
      const res = await probe(`https://${host}/api/v4/version`);
      if (!res) return 'unreachable';
      // Anonymous calls get a 401 with GitLab's own JSON shape; a signed-in
      // session (cookies are never sent here) would get the version.
      const body = res.body as { version?: unknown; message?: unknown } | null;
      const gitlab =
        res.headers.has('x-gitlab-meta') ||
        (res.status === 200 && typeof body?.version === 'string') ||
        (res.status === 401 && typeof body?.message === 'string');
      return gitlab ? 'ok' : 'mismatch';
    },
    revokeToken: async ({ host, token, clientId, clientSecret }) => {
      if (!clientId) return;
      const params: Record<string, string> = { client_id: clientId, token };
      if (clientSecret) params.client_secret = clientSecret;
      await sendRevoke(`https://${host}/oauth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
      });
    },
    fetchAccount: async (host, token) => {
      const user = await getJson<GitLabUser>(`https://${host}/api/v4/user`, token);
      return {
        providerId: id,
        host,
        displayName,
        login: user.username,
        // commit_email is exactly the address GitLab expects on commits; the
        // account email is not always the one it will attribute them to.
        email: user.commit_email || user.email || user.public_email || '',
        name: user.name,
        avatarDataUrl: await fetchAvatar(user.avatar_url),
      } satisfies FetchedAccount;
    },
  };
}

export const gitlab = makeGitLabProvider('gitlab', 'GitLab', 'gitlab', [
  'gitlab.com',
  'www.gitlab.com',
]);
export const gitlabSelf = makeGitLabProvider(
  'gitlab-self',
  'GitLab (self-managed)',
  'gitlab-self',
  [],
);
