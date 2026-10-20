import type { AccountGroup, ProviderAccount, ProviderId, ServerProbe } from '../../../src/types';

export type FetchedAccount = Omit<ProviderAccount, 'id' | 'repoPath'>;

interface OAuthEndpoints {
  authorizeUrl: string;
  tokenUrl: string;
}

export interface ProviderDefinition {
  id: ProviderId;
  displayName: string;
  group: AccountGroup;
  knownHosts: string[];
  oauth?: false;
  usesPkce: boolean;
  scopes: string[];
  endpoints: (host: string) => OAuthEndpoints;
  fetchAccount: (host: string, token: string) => Promise<FetchedAccount>;
  gitUsername?: (account: ProviderAccount) => string;
  tokenHelpUrl: (host: string) => string;
  probe?: (host: string) => Promise<ServerProbe>;
  revokeToken?: (opts: RevokeOptions) => Promise<void>;
}

interface RevokeOptions {
  host: string;
  token: string;
  clientId: string;
  clientSecret: string | null;
}
