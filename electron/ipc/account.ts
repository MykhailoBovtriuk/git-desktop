import { BrowserWindow, ipcMain, shell } from 'electron';
import type { ProviderAccount, ProviderId } from '../../src/types';
import { assertString } from '../ipc-validators';
import { wrap } from './wrap';
import { beginSignIn, cancelSignIn, completeSignIn } from '../auth/oauth-flow';
import { providerById, providerForHost, providerOptions } from '../auth/providers/registry';
import {
  accountsForHost,
  bindRepo,
  unbindRepo,
  boundAccount,
  clearCredential,
  isPersistent,
  listAccounts,
  saveCredential,
} from '../auth/token-store';
import { accountIdFor } from '../auth/account-id';
import { approveCredentials, gitUsernameFor, rejectCredentials } from '../auth/git-credentials';
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
 * Everything that has to happen once a token is in hand, whichever route it
 * arrived by. Kept in one place so the browser flow and the pasted-token flow
 * cannot drift apart on, say, whether identity gets bootstrapped.
 */
async function adoptAccount(
  account: ProviderAccount,
  token: string,
  refreshToken: string | null,
  expiresAt: number | null,
  clientId: string,
  clientSecret: string | null,
  /** The repository the sign-in was started from, if any. */
  repoPath: string | null = null,
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
  // Signing in from a repository is a statement about that repository: it is
  // the one place the user has told us which of several accounts it uses.
  if (repoPath) await bindRepo(repoPath, account.id);
  notify();
  return account;
}

/**
 * The browser came back. Called from the deep-link handler in main.ts rather
 * than over IPC — the renderer is not part of this round trip.
 */
let signInRepo: string | null = null;

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
      signInRepo,
    );
    signInRepo = null;
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
   * What this repository should commit and push as.
   *
   * Three answers, and the caller behaves differently for each: an account the
   * user already chose, a set of accounts on this host to choose between, or
   * nothing at all — which is the only case that needs a sign-in.
   */
  ipcMain.handle('account:for-repo', (_e, repoPath: unknown, host: unknown) =>
    wrap(async () => {
      assertString(repoPath, 'repoPath');
      if (typeof host !== 'string' || !host) return { bound: null, candidates: [] };
      assertHost(host);
      const bound = await boundAccount(repoPath);
      // A binding made before the remote was repointed elsewhere is stale.
      return {
        bound: bound && bound.host === host ? bound : null,
        candidates: await accountsForHost(host),
      };
    }),
  );

  ipcMain.handle('account:bind', (_e, repoPath: unknown, accountId: unknown) =>
    wrap(async () => {
      assertString(repoPath, 'repoPath');
      assertString(accountId, 'accountId');
      await bindRepo(repoPath, accountId);
      notify();
      return null;
    }),
  );

  ipcMain.handle('account:unbind', (_e, repoPath: unknown) =>
    wrap(async () => {
      assertString(repoPath, 'repoPath');
      if (await unbindRepo(repoPath)) notify();
      return null;
    }),
  );

  ipcMain.handle(
    'account:sign-in',
    (
      _e,
      providerId: unknown,
      host: unknown,
      clientId: unknown,
      clientSecret: unknown,
      repoPath: unknown,
    ) =>
      wrap(async () => {
        assertString(providerId, 'providerId');
        assertHost(host);
        signInRepo = typeof repoPath === 'string' && repoPath ? repoPath : null;
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
  // is built from the form because there is no API here we can rely on.
  ipcMain.handle(
    'account:sign-in-token',
    (_e, host: unknown, login: unknown, token: unknown, repoPath: unknown) =>
      wrap(async () => {
        assertHost(host);
        assertString(login, 'login');
        assertString(token, 'token');
        const account: ProviderAccount = {
          id: accountIdFor(host, login),
          providerId: 'token',
          host,
          displayName: host,
          login,
          name: null,
          email: '',
          avatarDataUrl: null,
        };
        // No expiry is known for a hand-made token, and there is nothing to
        // refresh it with — so it is stored as non-expiring and simply stops
        // working when the user revokes it.
        return adoptAccount(
          account,
          token,
          null,
          null,
          '',
          null,
          typeof repoPath === 'string' && repoPath ? repoPath : null,
        );
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
      signInRepo = null;
      lastError = null;
      return null;
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
