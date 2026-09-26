import type { ProviderAccount, ProviderId } from '../../../src/types';

/** An account as a provider knows it, before the store gives it an id. */
export type FetchedAccount = Omit<ProviderAccount, 'id'>;

export interface OAuthEndpoints {
  authorizeUrl: string;
  tokenUrl: string;
  apiBase: string;
}

/**
 * One hosting service. Everything provider-specific lives here, so the sign-in
 * engine has no per-provider branches.
 */
export interface ProviderDefinition {
  id: ProviderId;
  /** Brand name. Never translated. */
  displayName: string;
  /** Hosts this provider owns outright. Empty means the user supplies the address. */
  knownHosts: string[];
  /**
   * PKCE instead of a client secret; decides both the authorize URL and whether
   * the build needs a secret.
   */
  usesPkce: boolean;
  scopes: string[];
  /** Scope separator: OAuth says space, GitLab and GitHub both accept it. */
  endpoints: (host: string) => OAuthEndpoints;
  /** Token → normalised account. The storage id is stamped by the caller. */
  fetchAccount: (host: string, token: string) => Promise<FetchedAccount>;
  /**
   * The username git should send alongside the token. Azure DevOps ignores it
   * entirely, GitHub wants the login. Defaults to the account login.
   */
  gitUsername?: (account: ProviderAccount) => string;
  /** Where a user creates a token by hand, for the manual path. */
  tokenHelpUrl: (host: string) => string;
}
