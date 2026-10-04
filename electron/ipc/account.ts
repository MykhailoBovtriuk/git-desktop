import { BrowserWindow, ipcMain, shell } from 'electron';
import type { AuthSource, ProviderAccount, ProviderId } from '../../src/types';
import { assertString } from '../ipc-validators';
import { wrap } from './wrap';
import { beginSignIn, cancelSignIn, completeSignIn } from '../auth/oauth-flow';
import { providerById, providerForHost, providerOptions } from '../auth/providers/registry';
import {
  accountForHost,
  clearCredential,
  isPersistent,
  listAccounts,
  saveCredential,
} from '../auth/token-store';
import { accountIdFor } from '../auth/account-id';
import { hostFromRemoteUrl, originUrlFor } from '../auth/remote-host';
import { verifyAgainstRemote } from '../auth/verify-credential';
import {
  approveCredentials,
  forgetStoredCredential,
  gitUsernameFor,
  hasStoredCredential,
  rejectCredentials,
} from '../auth/git-credentials';
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

/**
 * Who a pasted token belongs to, and whether it works at all. Nothing is stored
 * before this resolves.
 */
async function accountFromToken(
  host: string,
  login: string,
  token: string,
  repoPath: string | null,
): Promise<ProviderAccount> {
  const provider = providerForHost(host);
  if (provider) {
    // A host we recognise has an API that both proves the token works and
    // knows the user's real name and avatar — better data than a form carries.
    const fetched = await provider.fetchAccount(host, token).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        /returned 40[13]/.test(message)
          ? `${provider.displayName} rejected this token`
          : `Could not check this token with ${provider.displayName}`,
      );
    });
    return { ...fetched, id: accountIdFor(host) };
  }

  // Nobody's API to ask: check the credential by using it against the very
  // remote it is meant for. Whatever `ls-remote` accepts, `git push` accepts.
  const remoteUrl = repoPath ? await originUrlFor(repoPath) : null;
  if (!remoteUrl || !/^https:\/\//i.test(remoteUrl) || hostFromRemoteUrl(remoteUrl) !== host) {
    throw new Error(
      `Sign in from a repository whose remote is an https address on ${host} — ` +
        'there is no other way to check a token for this server',
    );
  }
  await verifyAgainstRemote(remoteUrl, login, token);
  return {
    id: accountIdFor(host),
    providerId: 'token',
    host,
    displayName: host,
    login,
    name: null,
    email: '',
    avatarDataUrl: null,
  };
}

/**
 * Everything that happens once a token is in hand, shared by the browser and
 * pasted-token flows.
 */
async function adoptAccount(
  account: ProviderAccount,
  token: string,
  refreshToken: string | null,
  expiresAt: number | null,
  clientId: string,
  clientSecret: string | null,
): Promise<ProviderAccount> {
  await saveCredential({
    id: account.id,
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
  await approveCredentials(account.host, gitUsernameFor(account), token);
  await ensureGlobalIdentity(account);
  notify();
  return account;
}

/**
 * The browser came back. Called from the deep-link handler in main.ts rather
 * than over IPC — the renderer is not part of this round trip.
 */
export async function handleAuthCallback(url: string): Promise<void> {
  try {
    const result = await completeSignIn(url);
    await adoptAccount(
      result.account,
      result.token.accessToken,
      result.token.refreshToken,
      result.token.expiresAt,
      result.clientId,
      result.clientSecret,
    );
  } catch (err: unknown) {
    lastError = err instanceof Error ? err.message : String(err);
    notify();
  }
}

/**
 * The browser flow finishes outside any IPC call, so a failure has nowhere to
 * be thrown. It is parked here and collected with the next account list.
 */
let lastError: string | null = null;

export interface AccountsSnapshot {
  accounts: ProviderAccount[];
  /** False on a machine with no OS keychain: sign-in lasts this session only. */
  persistent: boolean;
  /** Set once by a failed browser round trip, then cleared. */
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

  /**
   * What authenticates this remote: ssh, an app account, the system keychain,
   * or nothing. Ssh is settled first so it never triggers a keychain lookup.
   */
  ipcMain.handle('account:auth-source', (_e, host: unknown, protocol: unknown) =>
    wrap(async (): Promise<AuthSource> => {
      if (typeof host !== 'string' || !host) return 'none';
      assertHost(host);
      if (await accountForHost(host)) return 'account';
      if (protocol !== 'https') return 'ssh';
      return (await hasStoredCredential(host)) ? 'system' : 'none';
    }),
  );

  ipcMain.handle(
    'account:sign-in',
    (_e, providerId: unknown, host: unknown, clientId: unknown, clientSecret: unknown) =>
      wrap(async () => {
        assertString(providerId, 'providerId');
        assertHost(host);
        const provider = providerById(providerId as ProviderId);
        if (!provider) throw new Error(`Unknown provider: ${providerId}`);

        const url = beginSignIn({
          provider,
          host,
          clientId: typeof clientId === 'string' ? clientId : undefined,
          clientSecret: typeof clientSecret === 'string' ? clientSecret : undefined,
        });
        await shell.openExternal(url);
        return null;
      }),
  );

  // The path for every server nobody registered an OAuth app for. The account
  // is built from whatever proved the token works, never from the form alone.
  ipcMain.handle(
    'account:sign-in-token',
    (_e, host: unknown, login: unknown, token: unknown, repoPath: unknown) =>
      wrap(async () => {
        assertHost(host);
        assertCredentialField(login, 'login');
        assertCredentialField(token, 'token');
        const repo = typeof repoPath === 'string' && repoPath ? repoPath : null;
        const account = await accountFromToken(host, login, token, repo);
        // A hand-made token has no known expiry and nothing to refresh it with,
        // so it is stored as non-expiring.
        return adoptAccount(account, token, null, null, '', null);
      }),
  );

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

  // For a credential stored outside the app: signing out of one of ours already
  // erases it.
  ipcMain.handle('account:forget-system-credential', (_e, host: unknown) =>
    wrap(async () => {
      assertHost(host);
      const forgotten = await forgetStoredCredential(host);
      notify();
      return forgotten;
    }),
  );

  ipcMain.handle('account:sign-out', (_e, accountId: unknown) =>
    wrap(async () => {
      assertString(accountId, 'accountId');
      const account = await clearCredential(accountId);
      if (account) await rejectCredentials(account.host, gitUsernameFor(account));
      notify();
      return null;
    }),
  );
}
