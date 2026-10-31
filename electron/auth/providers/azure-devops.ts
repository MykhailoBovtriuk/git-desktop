import { authedGet, basicAuth, getJson, HttpError, probe } from '../http';
import type { ServerProbe } from '../../../src/types';
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
  group: 'other',
  knownHosts: ['dev.azure.com', 'ssh.dev.azure.com', 'vs-ssh.visualstudio.com'],
  usesPkce: true,
  scopes: [`${AZURE_DEVOPS_RESOURCE}/.default`, 'offline_access'],
  endpoints: () => ({
    // "organizations" accepts work and school accounts from any tenant, which
    // is what a desktop client shipped to unknown users needs.
    authorizeUrl: 'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/organizations/oauth2/v2.0/token',
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
      login: email || (profile.displayName ?? ''),
      name: profile.displayName,
      email,
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

interface ConnectionData {
  authenticatedUser?: {
    providerDisplayName?: string;
    properties?: { Account?: { $value?: string } };
  };
}

/**
 * Where the server answers: newer installs at the root, older ones (and every
 * TFS-era upgrade) under the /tfs virtual directory.
 */
const SERVER_ROOTS = ['', '/tfs'];

/**
 * Azure DevOps Server, on premises. It has no OAuth for desktop apps, so a
 * personal access token is the only way in; it goes as Basic with any user.
 */
export const azureDevOpsServer: ProviderDefinition = {
  id: 'azure-devops-server',
  displayName: 'Azure DevOps Server',
  group: 'other',
  knownHosts: [],
  oauth: false,
  usesPkce: false,
  scopes: [],
  endpoints: () => ({ authorizeUrl: '', tokenUrl: '' }),
  tokenHelpUrl: host => `https://${host}/_usersSettings/tokens`,
  probe: async host => {
    let reached = false;
    for (const root of SERVER_ROOTS) {
      const res = await probe(`https://${host}${root}/_apis/connectionData`);
      if (!res) continue;
      reached = true;
      // Every Azure DevOps response is stamped with these, signed in or not.
      if (res.headers.has('x-tfs-processid') || res.headers.has('x-vss-e2eid')) return 'ok';
    }
    return (reached ? 'mismatch' : 'unreachable') satisfies ServerProbe;
  },
  fetchAccount: async (host, token) => {
    const basic = basicAuth('', token);
    let lastError: unknown = null;
    for (const root of SERVER_ROOTS) {
      try {
        const res = await authedGet(`https://${host}${root}/_apis/connectionData`, basic);
        const data = (await res.json()) as ConnectionData;
        const user = data.authenticatedUser;
        const account = user?.properties?.Account?.$value ?? '';
        if (!user || !account) continue;
        return {
          providerId: 'azure-devops-server',
          host,
          displayName: 'Azure DevOps Server',
          login: account,
          name: user.providerDisplayName ?? null,
          email: account.includes('@') ? account : '',
          avatarDataUrl: null,
        } satisfies FetchedAccount;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError ?? new HttpError(`https://${host} returned 401`, 401);
  },
  gitUsername: () => 'pat',
};
