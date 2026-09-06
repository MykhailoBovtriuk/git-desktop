import type { ProviderAccount, ProviderId } from '../../../src/types';

/** An account as a provider knows it, before the store gives it an id. */
export type FetchedAccount = Omit<ProviderAccount, 'id'>;

export interface OAuthEndpoints {
  authorizeUrl: string;
  tokenUrl: string;
  apiBase: string;
}

/**
 * One hosting service. Everything that differs between GitHub, GitLab, Azure
 * DevOps and the rest lives in one of these records, so the sign-in engine
 * itself has no per-provider branches and a ninth service is a new file rather
 * than an edit to five existing ones.
 */
export interface ProviderDefinition {
  id: ProviderId;
  /** Brand name. Never translated. */
  displayName: string;
  /** Hosts this provider owns outright. Empty means the user supplies the address. */
  knownHosts: string[];
  /**
   * PKCE instead of a client secret. Decides both what the authorize URL
   * carries and whether this build needs a secret baked in at all.
   */
  usesPkce: boolean;
  scopes: string[];
  /** Scope separator: OAuth says space, GitLab and GitHub both accept it. */
  endpoints: (host: string) => OAuthEndpoints;
  /**
   * Token → normalised account. The only place a provider's API shape lives.
   * The storage id is stamped by the caller: which key an account is filed
   * under is the store's business, not the provider's.
   */
  fetchAccount: (host: string, token: string) => Promise<FetchedAccount>;
  /**
   * The username git should send alongside the token. Azure DevOps ignores it
   * entirely, GitHub wants the login. Defaults to the account login.
   */
  gitUsername?: (account: ProviderAccount) => string;
  /** Where a user creates a token by hand, for the manual path. */
  tokenHelpUrl: (host: string) => string;
}
