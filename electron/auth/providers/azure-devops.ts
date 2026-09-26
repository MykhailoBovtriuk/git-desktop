import { getJson } from '../http';
import type { FetchedAccount, ProviderDefinition } from './types';

interface EntraProfile {
  displayName: string | null;
  emailAddress: string | null;
  coreAttributes?: { Avatar?: { value?: { value?: string } } };
}

/**
 * The Azure DevOps resource id in Entra ID, the same for every tenant; its
 * `.default` scope makes the token valid for dev.azure.com.
 */
const AZURE_DEVOPS_RESOURCE = '499b84ac-1321-427f-aa17-267ca6975798';

/**
 * Azure DevOps via Entra ID (the old Azure DevOps OAuth is being retired).
 * Public client with PKCE; `offline_access` is required for a refresh token.
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
      // The avatar comes as base64 in the JSON, so there is nothing to fetch.
      avatarDataUrl: avatarFromProfile(profile),
    } satisfies FetchedAccount;
  },
  // dev.azure.com reads the token from the password field; a fixed username
  // keeps the credential stable across profile renames.
  gitUsername: () => 'oauth2',
};

function avatarFromProfile(profile: EntraProfile): string | null {
  const value = profile.coreAttributes?.Avatar?.value?.value;
  return value ? `data:image/png;base64,${value}` : null;
}
