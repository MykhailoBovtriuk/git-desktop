import type {
  AuthSource,
  CredentialHelperEntry,
  ProviderAccount,
  ProviderId,
  RemoteProtocol,
  ServerProbe,
  AccountsSnapshot,
  ProvidersForHost,
} from '../types';
import { invoke } from './invoke';

export const accountApi = {
  list: () => invoke<AccountsSnapshot>('account:list'),
  providersFor: (host: string | null) => invoke<ProvidersForHost>('account:providers', host),
  authSource: (host: string, protocol: RemoteProtocol | null, repoPath: string | null) =>
    invoke<AuthSource>('account:auth-source', host, protocol, repoPath),
  signIn: (
    providerId: ProviderId,
    host: string,
    repoPath: string,
    clientId?: string,
    clientSecret?: string,
  ) => invoke<null>('account:sign-in', providerId, host, repoPath, clientId, clientSecret),
  signInWithToken: (
    providerId: ProviderId,
    host: string,
    login: string,
    token: string,
    repoPath: string,
  ) => invoke<ProviderAccount>('account:sign-in-token', providerId, host, login, token, repoPath),
  probeServer: (providerId: ProviderId, host: string) =>
    invoke<ServerProbe>('account:probe-server', providerId, host),
  credentialHelpers: () => invoke<CredentialHelperEntry[]>('account:credential-helpers'),
  openTokenHelp: (providerId: ProviderId, host: string) =>
    invoke<null>('account:open-token-help', providerId, host),
  cancelSignIn: () => invoke<null>('account:cancel-sign-in'),
  signOut: (repoPath: string) => invoke<null>('account:sign-out', repoPath),
  forgetSystemCredential: (host: string) =>
    invoke<boolean>('account:forget-system-credential', host),
  onAccountChanged: (cb: () => void) => window.electronAPI.onAccountChanged(cb),
};
