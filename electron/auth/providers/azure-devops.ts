import { getJson } from '../http';
import type { FetchedAccount, ProviderDefinition } from './types';

interface EntraProfile {
  displayName: string | null;
  emailAddress: string | null;
  coreAttributes?: { Avatar?: { value?: { value?: string } } };
}

/**
 * The resource id of Azure DevOps in Microsoft Entra ID. A fixed GUID, the same
 * for every tenant — asking for its `.default` scope is what makes the issued
 * token usable against dev.azure.com.
 */
const AZURE_DEVOPS_RESOURCE = '499b84ac-1321-427f-aa17-267ca6975798';

/**
 * Azure DevOps, through Microsoft Entra ID.
 *
 * The older "Azure DevOps OAuth" service at app.vssps.visualstudio.com is being
 * retired and no longer accepts new app registrations, so Entra ID is the only
 * forward-looking path. It is a public client with PKCE, so no secret.
 *
 * `offline_access` is what makes a refresh token appear; without it the ~1 hour
 * access token expires and there is no way back short of a fresh sign-in.
 */
export const azureDevOps: ProviderDefinition = {
  id: 'azure-devops',
  displayName: 'Azure DevOps',
  knownHosts: ['dev.azure.com', 'ssh.dev.azure.com', 'vs-ssh.visualstudio.com'],
  usesPkce: true,
  scopes: [`${AZURE_DEVOPS_RESOURCE}/.default`, 'offline_access'],
  endpoints: () => ({
    // "organizations" accepts work and school accounts from any tenant, which
    // is what a desktop client shipped to unknown users needs.
    authorizeUrl: 'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/organizations/oauth2/v2.0/token',
    apiBase: 'https://app.vssps.visualstudio.com/_apis',
  }),
  tokenHelpUrl: () => 'https://dev.azure.com',
  fetchAccount: async (host, token) => {
    const profile = await getJson<EntraProfile>(
      'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.0',
      token,
    );
    const email = profile.emailAddress ?? '';
    return {
      providerId: 'azure-devops',
      host,
      displayName: 'Azure DevOps',
      // Azure has no "@handle"; the email is the closest thing to a login and
      // is what the user recognises.
      login: email || (profile.displayName ?? ''),
      name: profile.displayName,
      email,
      // The profile avatar arrives as base64 inside the JSON rather than a URL,
      // so there is nothing to fetch — and nothing to fetch it from without a
      // second authenticated request.
      avatarDataUrl: avatarFromProfile(profile),
    } satisfies FetchedAccount;
  },
  // dev.azure.com ignores the username entirely and reads the token from the
  // password field. Sending the email would work too, but a fixed value keeps
  // the stored credential stable across profile renames.
  gitUsername: () => 'oauth2',
};

function avatarFromProfile(profile: EntraProfile): string | null {
  const value = profile.coreAttributes?.Avatar?.value?.value;
  return value ? `data:image/png;base64,${value}` : null;
}
