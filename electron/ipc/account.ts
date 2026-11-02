import { ipcMain, shell } from 'electron';
import type {
  AccountsSnapshot,
  AuthSource,
  ProviderAccount,
  ProviderId,
  ProvidersForHost,
  ServerProbe,
} from '../../src/types';
import { assertCredentialField, assertHost, assertRepoPath, assertString } from '../ipc-validators';
import { isRejected } from '../auth/http';
import { QUIET, wrap, wrapLoggedFor, sendToRenderer, type WindowOptions } from './wrap';
import { beginSignIn, cancelSignIn, completeSignIn, pendingTarget } from '../auth/oauth-flow';
import { logged, logIdOf, markCurrent } from '../log/git-logger';
import { errorMessage, errorWithCause } from '../../src/lib/error-message';
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

let notify: () => void = () => {};

function signInDetail(providerId: unknown, host: unknown): string | undefined {
  const parts = [providerId, host].filter((p): p is string => typeof p === 'string' && !!p);
  return parts.length ? parts.join(' · ') : undefined;
}

function requireProvider(id: unknown): ProviderDefinition {
  assertString(id, 'providerId');
  const provider = providerById(id as ProviderId);
  if (!provider) throw new Error(`Unknown provider: ${id}`);
  return provider;
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
      throw errorWithCause(
        isRejected(err)
          ? `${provider.displayName} rejected this token`
          : `Could not check this token with ${provider.displayName}`,
        err,
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

type Grant = Pick<
  StoredCredential,
  'accessToken' | 'refreshToken' | 'expiresAt' | 'clientId' | 'clientSecret'
>;

async function adoptAccount(account: ProviderAccount, grant: Grant): Promise<ProviderAccount> {
  await releaseRepo(account.repoPath, { revokeToken: true, notify: false });
  await saveCredential({ repoPath: account.repoPath, host: account.host, account, ...grant });
  // Order matters: git has to be able to authenticate before anything tells the
  // user they are signed in.
  const username = gitUsernameFor(account);
  await approveCredentials(account.host, username, grant.accessToken);
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
  opts: { revokeToken: boolean; notify: boolean; forgotten?: boolean },
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
    // A forgotten repository's log is already deleted: the app log takes the entry.
    const logTo = opts.forgotten ? null : repoPath;
    void revoke(stored.account.providerId, stored.host, stored, logTo);
  }
  if (opts.notify) notify();
  return stored;
}

export async function forgetRepoAccount(repoPath: string): Promise<void> {
  await releaseRepo(repoPath, { revokeToken: true, notify: true, forgotten: true });
}

export async function handleAuthCallback(url: string): Promise<void> {
  // Assigned inside the logged callback, which TypeScript's narrowing cannot see.
  let result = null as Awaited<ReturnType<typeof completeSignIn>> | null;
  const target = pendingTarget();
  try {
    await logged(
      'sign-in-callback',
      target?.repoPath ?? null,
      target ? signInDetail(target.providerId, target.host) : undefined,
      async () => {
        result = await completeSignIn(url);
        await adoptAccount(result.account, grantOf(result));
      },
    );
  } catch (err: unknown) {
    if (result) {
      const { account } = result;
      void revoke(account.providerId, account.host, grantOf(result), account.repoPath);
    }
    lastFailure = { message: errorMessage(err), logId: logIdOf(err) ?? null };
    notify();
  }
}

const grantOf = (result: Awaited<ReturnType<typeof completeSignIn>>): Grant => ({
  accessToken: result.token.accessToken,
  refreshToken: result.token.refreshToken,
  expiresAt: result.token.expiresAt,
  clientId: result.clientId,
  clientSecret: result.clientSecret,
});

async function revoke(
  providerId: ProviderId,
  host: string,
  grant: Grant,
  repoPath: string | null,
): Promise<void> {
  const { accessToken: token, clientId, clientSecret } = grant;
  const provider = providerById(providerId);
  if (!provider?.revokeToken) return;
  const revokeToken = provider.revokeToken;
  await logged('token-revoke', repoPath, signInDetail(providerId, host), () =>
    revokeToken({ host, token, clientId, clientSecret }),
  ).catch(() => {});
}

/**
 * The browser flow finishes outside any IPC call, so a failure has nowhere to
 * be thrown. It is parked here and collected with the next account list.
 */
let lastFailure: { message: string; logId: string | null } | null = null;

export function registerAccountHandlers(options: WindowOptions = {}) {
  notify = () => sendToRenderer(options, 'account:changed');

  ipcMain.handle('account:list', () =>
    wrap(async (): Promise<AccountsSnapshot> => {
      const failure = lastFailure;
      lastFailure = null;
      return {
        accounts: await listAccounts(),
        persistent: isPersistent(),
        error: failure?.message ?? null,
        errorLogId: failure?.logId ?? null,
      };
    }),
  );

  ipcMain.handle('account:providers', (_e, host: unknown) =>
    wrap(async (): Promise<ProvidersForHost> => {
      const known = typeof host === 'string' && host ? host : null;
      return {
        host: known,
        providerId: known ? (providerForHost(known)?.id ?? null) : null,
        options: providerOptions(known),
      };
    }),
  );

  ipcMain.handle('account:auth-source', (_e, host: unknown, protocol: unknown, repoPath: unknown) =>
    wrapLoggedFor(
      'credential-store',
      repoPath,
      host,
      async (): Promise<AuthSource> => {
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
      },
      QUIET,
    ),
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
      wrapLoggedFor('sign-in-browser', repoPath, signInDetail(providerId, host), async () => {
        const provider = requireProvider(providerId);
        assertHost(host);
        assertRepoPath(repoPath);

        const url = beginSignIn({
          provider,
          host,
          repoPath,
          clientId: typeof clientId === 'string' ? clientId : undefined,
          clientSecret: typeof clientSecret === 'string' ? clientSecret : undefined,
        });
        await shell.openExternal(url);
      }),
  );

  ipcMain.handle(
    'account:sign-in-token',
    (_e, providerId: unknown, host: unknown, login: unknown, token: unknown, repoPath: unknown) =>
      wrapLoggedFor('sign-in-token', repoPath, signInDetail(providerId, host), async () => {
        const { id } = requireProvider(providerId);
        assertHost(host);
        if (providerId === 'token' || login !== '') assertCredentialField(login, 'login');
        assertCredentialField(token, 'token');
        assertRepoPath(repoPath);
        const account = await accountFromToken(id, host, login as string, token, repoPath);
        return adoptAccount(account, {
          accessToken: token,
          refreshToken: null,
          expiresAt: null,
          clientId: '',
          clientSecret: null,
        });
      }),
  );

  ipcMain.handle(
    'account:probe-server',
    (_e, providerId: unknown, host: unknown, repoPath: unknown) =>
      wrapLoggedFor(
        'probe-server',
        repoPath,
        signInDetail(providerId, host),
        async (): Promise<ServerProbe> => {
          const provider = requireProvider(providerId);
          assertHost(host);
          const answer = provider.probe ? await provider.probe(host) : 'ok';
          if (answer !== 'ok') {
            markCurrent({
              status: 'warning',
              error:
                answer === 'unreachable'
                  ? `Could not reach ${host}`
                  : `${host} does not look like ${provider.displayName}`,
            });
          }
          return answer;
        },
        QUIET,
      ),
  );

  ipcMain.handle('account:credential-helpers', () =>
    wrapLoggedFor('credential-store', null, 'credential helpers', listCredentialHelpers, QUIET),
  );

  ipcMain.handle('account:open-token-help', (_e, providerId: unknown, host: unknown) =>
    wrapLoggedFor(
      'sign-in-browser',
      null,
      signInDetail(providerId, host),
      async () => {
        const provider = requireProvider(providerId);
        assertHost(host);
        // Built here, from a validated host — so this cannot become a way for the
        // renderer to open an arbitrary address.
        await shell.openExternal(provider.tokenHelpUrl(host));
      },
      QUIET,
    ),
  );

  ipcMain.handle('account:cancel-sign-in', () =>
    wrap(async () => {
      cancelSignIn();
      lastFailure = null;
    }),
  );

  ipcMain.handle('account:forget-system-credential', (_e, host: unknown, repoPath: unknown) =>
    wrapLoggedFor('credential-forget', repoPath, host, async () => {
      assertHost(host);
      const forgotten = await forgetStoredCredential(host);
      notify();
      return forgotten;
    }),
  );

  ipcMain.handle('account:sign-out', (_e, repoPath: unknown) =>
    wrapLoggedFor('sign-out', repoPath, undefined, async () => {
      assertRepoPath(repoPath);
      await releaseRepo(repoPath, { revokeToken: true, notify: true });
    }),
  );
}
