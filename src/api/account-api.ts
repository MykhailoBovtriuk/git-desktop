import type {
  AuthSource,
  ProviderAccount,
  ProviderId,
  ProviderOption,
  RemoteProtocol,
} from '../types';
import { invoke } from './invoke';

export interface AccountsSnapshot {
  accounts: ProviderAccount[];
  /** False on a machine with no OS keychain: sign-in lasts this session only. */
  persistent: boolean;
  /** A browser round trip that failed after the IPC call had already returned. */
  error: string | null;
}

export interface ProvidersForHost {
  host: string | null;
  /** The provider that owns this host, or null when the user has to choose. */
  providerId: ProviderId | null;
  options: ProviderOption[];
}

export const accountApi = {
  list: () => invoke<AccountsSnapshot>('account:list'),
  providersFor: (host: string | null) => invoke<ProvidersForHost>('account:providers', host),
  authSource: (host: string, protocol: RemoteProtocol | null) =>
    invoke<AuthSource>('account:auth-source', host, protocol),
  signIn: (providerId: ProviderId, host: string, clientId?: string, clientSecret?: string) =>
    invoke<null>('account:sign-in', providerId, host, clientId, clientSecret),
  signInWithToken: (host: string, login: string, token: string, repoPath?: string | null) =>
    invoke<ProviderAccount>('account:sign-in-token', host, login, token, repoPath),
  openTokenHelp: (providerId: ProviderId, host: string) =>
    invoke<null>('account:open-token-help', providerId, host),
  cancelSignIn: () => invoke<null>('account:cancel-sign-in'),
  signOut: (accountId: string) => invoke<null>('account:sign-out', accountId),
  onAccountChanged: (cb: () => void) => window.electronAPI.onAccountChanged(cb),
};
