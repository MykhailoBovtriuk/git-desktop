import type {
  AuthSource,
  ProviderAccount,
  ProviderId,
  RemoteProtocol,
  RepoIdentity,
  RepoTestResult,
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
  identity: (repoPath: string) => invoke<RepoIdentity>('account:identity', repoPath),
  signIn: (
    providerId: ProviderId,
    host: string,
    repoPath: string,
    clientId?: string,
    clientSecret?: string,
  ) => invoke<null>('account:sign-in', providerId, host, repoPath, clientId, clientSecret),
  signInWithToken: (providerId: ProviderId, host: string, token: string, repoPath: string) =>
    invoke<ProviderAccount>('account:sign-in-token', providerId, host, token, repoPath),
  probeServer: (providerId: ProviderId, host: string, repoPath: string | null) =>
    invoke<ServerProbe>('account:probe-server', providerId, host, repoPath),
  test: (repoPath: string) => invoke<RepoTestResult>('account:test', repoPath),
  openTokenHelp: (providerId: ProviderId, host: string) =>
    invoke<null>('account:open-token-help', providerId, host),
  openOrgAccess: (repoPath: string | null) => invoke<null>('account:open-org-access', repoPath),
  cancelSignIn: () => invoke<null>('account:cancel-sign-in'),
  signOut: (repoPath: string) => invoke<null>('account:sign-out', repoPath),
  forgetSystemCredential: (host: string, repoPath: string | null) =>
    invoke<boolean>('account:forget-system-credential', host, repoPath),
  onAccountChanged: (cb: () => void) => window.electronAPI.onAccountChanged(cb),
};
