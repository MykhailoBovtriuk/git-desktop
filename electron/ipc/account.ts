import { BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import type { AuthSource, ProviderAccount, ProviderId, ServerProbe } from '../../src/types';
import { assertString } from '../ipc-validators';
import { wrap } from './wrap';
import { beginSignIn, cancelSignIn, completeSignIn } from '../auth/oauth-flow';
import { providerById, providerForHost, providerOptions } from '../auth/providers/registry';
import {
  accountForRepo,
  clearCredential,
  credentialsOnHost,
  isPersistent,
  listAccounts,
  saveCredential,
  type StoredCredential,
} from '../auth/token-store';
import { hostFromRemoteUrl, originUrlFor } from '../auth/remote-host';
import { verifyAgainstRemote } from '../auth/verify-credential';
import {
  approveCredentials,
  bindRepoUsername,
  forgetStoredCredential,
  gitUsernameFor,
  listCredentialHelpers,
  rejectCredentials,
  storedUsername,
  unbindRepoUsername,
} from '../auth/git-credentials';
import type { ProviderDefinition } from '../auth/providers/types';
import { ensureGlobalIdentity } from '../auth/identity-bootstrap';

export interface AccountHandlerOptions {
  getWindow?: () => BrowserWindow | null;
}

let notify: () => void = () => {};

function assertHost(value: unknown): asserts value is string {
  assertString(value, 'host');
  // Hosts reach `git credential` and a URL; a value with whitespace or a slash
  // in it is either a mistake or an attempt to smuggle a second field in.
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(value as string)) {
    throw new Error('Invalid argument: host is not a hostname');
  }
}

function assertRepoPath(value: unknown): asserts value is string {
  assertString(value, 'repoPath');
  if (!path.isAbsolute(value as string) || /[\r\n\0]/.test(value as string)) {
    throw new Error('Invalid argument: repoPath is not an absolute path');
  }
}

/**
 * A value for `git credential`, which is one `key=value` per line: a newline
 * would inject a second field.
 */
function assertCredentialField(value: unknown, name: string): asserts value is string {
  assertString(value, name);
  if (/[\r\n\0]/.test(value as string)) {
    throw new Error(`Invalid argument: ${name} contains a line break`);
  }
}

async function accountFromToken(
  providerId: ProviderId,
  host: string,
  login: string,
  token: string,
  repoPath: string,
): Promise<ProviderAccount> {
  const provider = providerId === 'token' ? providerForHost(host) : providerById(providerId);
  if (provider) {
    const fetched = await provider.fetchAccount(host, token).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        /returned 40[13]/.test(message)
          ? `${provider.displayName} rejected this token`
          : `Could not check this token with ${provider.displayName}`,
      );
    });
    return { ...fetched, id: repoPath, repoPath };
  }

  const remoteUrl = await originUrlFor(repoPath);
  if (!remoteUrl || !/^https:\/\//i.test(remoteUrl) || hostFromRemoteUrl(remoteUrl) !== host) {
    throw new Error(
      `Sign in from a repository whose remote is an https address on ${host} — ` +
        'there is no other way to check a token for this server',
    );
  }
  await verifyAgainstRemote(remoteUrl, login, token);
  return {
    id: repoPath,
    repoPath,
    providerId: 'token',
    host,
    displayName: host,
    login,
    name: null,
    email: '',
    avatarDataUrl: null,
  };
}

async function adoptAccount(
  account: ProviderAccount,
  token: string,
  refreshToken: string | null,
  expiresAt: number | null,
  clientId: string,
  clientSecret: string | null,
): Promise<ProviderAccount> {
  await releaseRepo(account.repoPath, { revokeToken: true, notify: false });
  await saveCredential({
    repoPath: account.repoPath,
    host: account.host,
    account,
    accessToken: token,
    refreshToken,
    expiresAt,
    clientId,
    clientSecret,
  });
  // Order matters: git has to be able to authenticate before anything tells the
  // user they are signed in.
  const username = gitUsernameFor(account);
  await approveCredentials(account.host, username, token);
  await bindRepoUsername(account.repoPath, account.host, username);
  await ensureGlobalIdentity(account);
  notify();
  return account;
}

/**
 * Sign a repository out: its account, the username in its `.git/config`, and
 * the system credential store's copy unless another repository still signs in
 * as the same user there — then that one's token is put back in its place.
 */
async function releaseRepo(
  repoPath: string,
  opts: { revokeToken: boolean; notify: boolean },
): Promise<StoredCredential | null> {
  const stored = await clearCredential(repoPath);
  if (!stored) return null;
  const username = gitUsernameFor(stored.account);
  await unbindRepoUsername(repoPath, stored.host);
  const sharing = (await credentialsOnHost(stored.host)).find(
    c => gitUsernameFor(c.account) === username,
  );
  if (sharing) await approveCredentials(stored.host, username, sharing.accessToken);
  else await rejectCredentials(stored.host, username);
  if (opts.revokeToken && stored.accessToken !== sharing?.accessToken) {
    void revoke(providerById(stored.account.providerId), {
      host: stored.host,
      token: stored.accessToken,
      clientId: stored.clientId,
      clientSecret: stored.clientSecret,
    });
  }
  if (opts.notify) notify();
  return stored;
}

export async function forgetRepoAccount(repoPath: string): Promise<void> {
  await releaseRepo(repoPath, { revokeToken: true, notify: true });
}

export async function handleAuthCallback(url: string): Promise<void> {
  let result: Awaited<ReturnType<typeof completeSignIn>> | null = null;
  try {
    result = await completeSignIn(url);
    await adoptAccount(
      result.account,
      result.token.accessToken,
      result.token.refreshToken,
      result.token.expiresAt,
      result.clientId,
      result.clientSecret,
    );
  } catch (err: unknown) {
    if (result) {
      void revoke(providerById(result.account.providerId), {
        host: result.account.host,
        token: result.token.accessToken,
        clientId: result.clientId,
        clientSecret: result.clientSecret,
      });
    }
    lastError = err instanceof Error ? err.message : String(err);
    notify();
  }
}

async function revoke(
  provider: ProviderDefinition | null,
  opts: Parameters<NonNullable<ProviderDefinition['revokeToken']>>[0],
): Promise<void> {
  await provider?.revokeToken?.(opts).catch(() => {});
}

/**
 * The browser flow finishes outside any IPC call, so a failure has nowhere to
 * be thrown. It is parked here and collected with the next account list.
 */
let lastError: string | null = null;

export interface AccountsSnapshot {
  accounts: ProviderAccount[];
  persistent: boolean;
  error: string | null;
}

export function registerAccountHandlers(options: AccountHandlerOptions = {}) {
  notify = () => options.getWindow?.()?.webContents.send('account:changed');

  ipcMain.handle('account:list', () =>
    wrap(async () => {
      const error = lastError;
      lastError = null;
      return { accounts: await listAccounts(), persistent: isPersistent(), error };
    }),
  );

  ipcMain.handle('account:providers', (_e, host: unknown) =>
    wrap(async () => {
      const known = typeof host === 'string' && host ? host : null;
      return {
        host: known,
        providerId: known ? (providerForHost(known)?.id ?? null) : null,
        options: providerOptions(known),
      };
    }),
  );

  ipcMain.handle('account:auth-source', (_e, host: unknown, protocol: unknown, repoPath: unknown) =>
    wrap(async (): Promise<AuthSource> => {
      if (typeof host !== 'string' || !host) return 'none';
      assertHost(host);
      if (typeof repoPath === 'string' && repoPath) {
        assertRepoPath(repoPath);
        if ((await accountForRepo(repoPath))?.host === host) return 'account';
      }
      if (protocol !== 'https') return 'ssh';
      const username = await storedUsername(host);
      if (username === null) return 'none';
      // The app's own entry for another repository is not this one's login:
      // each repository signs in for itself.
      const ours = (await credentialsOnHost(host)).some(
        c => gitUsernameFor(c.account) === username,
      );
      return ours ? 'none' : 'system';
    }),
  );

  ipcMain.handle(
    'account:sign-in',
    (
      _e,
      providerId: unknown,
      host: unknown,
      repoPath: unknown,
      clientId: unknown,
      clientSecret: unknown,
    ) =>
      wrap(async () => {
        assertString(providerId, 'providerId');
        assertHost(host);
        assertRepoPath(repoPath);
        const provider = providerById(providerId as ProviderId);
        if (!provider) throw new Error(`Unknown provider: ${providerId}`);

        const url = beginSignIn({
          provider,
          host,
          repoPath,
          clientId: typeof clientId === 'string' ? clientId : undefined,
          clientSecret: typeof clientSecret === 'string' ? clientSecret : undefined,
        });
        await shell.openExternal(url);
        return null;
      }),
  );

  ipcMain.handle(
    'account:sign-in-token',
    (_e, providerId: unknown, host: unknown, login: unknown, token: unknown, repoPath: unknown) =>
      wrap(async () => {
        assertString(providerId, 'providerId');
        if (!providerById(providerId as ProviderId)) {
          throw new Error(`Unknown provider: ${providerId}`);
        }
        assertHost(host);
        if (providerId === 'token' || login !== '') assertCredentialField(login, 'login');
        assertCredentialField(token, 'token');
        assertRepoPath(repoPath);
        const account = await accountFromToken(
          providerId as ProviderId,
          host,
          login as string,
          token,
          repoPath,
        );
        return adoptAccount(account, token, null, null, '', null);
      }),
  );

  ipcMain.handle('account:probe-server', (_e, providerId: unknown, host: unknown) =>
    wrap(async (): Promise<ServerProbe> => {
      assertString(providerId, 'providerId');
      assertHost(host);
      const provider = providerById(providerId as ProviderId);
      if (!provider) throw new Error(`Unknown provider: ${providerId}`);
      return provider.probe ? provider.probe(host) : 'ok';
    }),
  );

  ipcMain.handle('account:credential-helpers', () => wrap(() => listCredentialHelpers()));

  ipcMain.handle('account:open-token-help', (_e, providerId: unknown, host: unknown) =>
    wrap(async () => {
      assertString(providerId, 'providerId');
      assertHost(host);
      const provider = providerById(providerId as ProviderId);
      if (!provider) throw new Error(`Unknown provider: ${providerId}`);
      // Built here, from a validated host — so this cannot become a way for the
      // renderer to open an arbitrary address.
      await shell.openExternal(provider.tokenHelpUrl(host));
      return null;
    }),
  );

  ipcMain.handle('account:cancel-sign-in', () =>
    wrap(async () => {
      cancelSignIn();
      lastError = null;
      return null;
    }),
  );

  ipcMain.handle('account:forget-system-credential', (_e, host: unknown) =>
    wrap(async () => {
      assertHost(host);
      const forgotten = await forgetStoredCredential(host);
      notify();
      return forgotten;
    }),
  );

  ipcMain.handle('account:sign-out', (_e, repoPath: unknown) =>
    wrap(async () => {
      assertRepoPath(repoPath);
      await releaseRepo(repoPath, { revokeToken: true, notify: true });
      return null;
    }),
  );
}
