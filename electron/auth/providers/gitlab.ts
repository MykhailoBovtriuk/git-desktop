import type { ProviderId } from '../../../src/types';
import { getJson, fetchAvatar } from '../http';
import type { FetchedAccount, ProviderDefinition } from './types';

interface GitLabUser {
  username: string;
  name: string | null;
  email: string | null;
  commit_email: string | null;
  public_email: string | null;
  avatar_url: string | null;
}

/**
 * GitLab supports PKCE for public clients, so no secret is needed and forks can
 * ship a working browser sign-in. Self-managed instances are the same service
 * at a different address.
 */
function makeGitLabProvider(
  id: ProviderId,
  displayName: string,
  knownHosts: string[],
): ProviderDefinition {
  return {
    id,
    displayName,
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

export const gitlab = makeGitLabProvider('gitlab', 'GitLab', ['gitlab.com', 'www.gitlab.com']);
export const gitlabSelf = makeGitLabProvider('gitlab-self', 'GitLab (self-managed)', []);
