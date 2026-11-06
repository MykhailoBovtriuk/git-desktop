import { ipcMain, shell } from 'electron';
import type {
  AccountsSnapshot,
  AuthSource,
  ProviderAccount,
  ProviderId,
  ProvidersForHost,
  RepoIdentity,
  RepoTestResult,
  ServerProbe,
} from '../../src/types';
import { assertCredentialField, assertHost, assertRepoPath, assertString } from '../ipc-validators';
import { isRejected } from '../auth/http';
import { QUIET, wrap, wrapLoggedFor, sendToRenderer, type WindowOptions } from './wrap';
import { beginSignIn, cancelSignIn, completeSignIn, pendingTarget } from '../auth/oauth-flow';
import { logEvent, logged, logIdOf, markCurrent } from '../log/git-logger';
import { errorMessage, errorWithCause } from '../../src/lib/error-message';
import { providerById, providerForHost, providerOptions } from '../auth/providers/registry';
import {
  accountForRepo,
  clearCredential,
  isPersistent,
  listAccounts,
  saveCredential,
  type StoredCredential,
} from '../auth/token-store';
import {
  approveCredentials,
  bindRepoUsername,
  forgetStoredCredential,
  gitUsernameFor,
  unbindRepoUsername,
} from '../auth/git-credentials';
import { releaseGitCredential } from '../auth/release-git-credential';
import type { ProviderDefinition } from '../auth/providers/types';
import { ensureGlobalIdentity } from '../auth/identity-bootstrap';
import { clearIdentityCache, resolveIdentity, systemCredentialFor } from '../auth/repo-identity';
import { runRepoTest } from '../auth/repo-test';
import { githubOrgAccessUrl } from '../auth/oauth-config';

let notify: () => void = () => {};

function signInDetail(providerId: unknown, host: unknown): string | undefined {
  const parts = [providerId, host].filter((p): p is string => typeof p === 'string' && !!p);
  return parts.length ? parts.join(' · ') : undefined;
}

const ORG_ACCESS_DETAIL = 'github · github.com · org access';

// These run QUIET, which logs only failures; a page opened is still a sign-in step (§5.5).
function logOpened(repoPath: string | null, detail: string): void {
  logEvent({ op: 'sign-in-browser', repoPath, status: 'info', detail });
}

function requireProvider(id: unknown): ProviderDefinition {
  assertString(id, 'providerId');
  const provider = providerById(id as ProviderId);
  if (!provider) throw new Error(`Unknown provider: ${id}`);
  return provider;
}

async function accountFromToken(
  provider: ProviderDefinition,
  host: string,
  token: string,
  repoPath: string,
): Promise<ProviderAccount> {
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
  const sharing = await releaseGitCredential(stored.host, username);
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
  notify = () => {
    clearIdentityCache();
    sendToRenderer(options, 'account:changed');
  };

  ipcMain.handle('account:list', () =>
    wrapLoggedFor(
      'accounts-load',
      null,
      undefined,
      async (): Promise<AccountsSnapshot> => {
        const accounts = await listAccounts();
        const failure = lastFailure;
        lastFailure = null;
        return {
          accounts,
          persistent: isPersistent(),
          error: failure?.message ?? null,
          errorLogId: failure?.logId ?? null,
        };
      },
      QUIET,
    ),
  );

  ipcMain.handle('account:providers', (_e, host: unknown) =>
    wrap(async (): Promise<ProvidersForHost> => {
      const known = typeof host === 'string' && host ? host : null;
      return {
        host: known,
        providerId: known ? (providerForHost(known)?.id ?? null) : null,
        options: providerOptions(),
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
        const ownRepo = typeof repoPath === 'string' && repoPath ? repoPath : null;
        return (await systemCredentialFor(host, ownRepo)) ? 'system' : 'none';
      },
      QUIET,
    ),
  );

  ipcMain.handle('account:identity', (_e, repoPath: unknown) =>
    wrapLoggedFor(
      'account-profile',
      repoPath,
      undefined,
      async (): Promise<RepoIdentity> => {
        assertRepoPath(repoPath);
        return resolveIdentity(repoPath);
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
    (_e, providerId: unknown, host: unknown, token: unknown, repoPath: unknown) =>
      wrapLoggedFor('sign-in-token', repoPath, signInDetail(providerId, host), async () => {
        const provider = requireProvider(providerId);
        assertHost(host);
        assertCredentialField(token, 'token');
        assertRepoPath(repoPath);
        const account = await accountFromToken(provider, host, token, repoPath);
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

  ipcMain.handle('account:test', (_e, repoPath: unknown) =>
    wrapLoggedFor(
      'auth-test',
      repoPath,
      undefined,
      async (): Promise<RepoTestResult> => {
        assertRepoPath(repoPath);
        return runRepoTest(repoPath);
      },
      QUIET,
    ),
  );

  ipcMain.handle('account:open-token-help', (_e, providerId: unknown, host: unknown) =>
    wrapLoggedFor(
      'sign-in-browser',
      null,
      `${signInDetail(providerId, host) ?? 'unknown'} · token help`,
      async () => {
        const provider = requireProvider(providerId);
        assertHost(host);
        // Built here, from a validated host — so this cannot become a way for the
        // renderer to open an arbitrary address.
        await shell.openExternal(provider.tokenHelpUrl(host));
        logOpened(null, `${provider.id} · ${host} · token help`);
      },
      QUIET,
    ),
  );

  ipcMain.handle('account:open-org-access', (_e, repoPath: unknown) =>
    wrapLoggedFor(
      'sign-in-browser',
      repoPath,
      ORG_ACCESS_DETAIL,
      async () => {
        if (repoPath != null) assertRepoPath(repoPath);
        // Never a URL from the renderer: the address is built here from the
        // client id baked into the build.
        await shell.openExternal(githubOrgAccessUrl());
        logOpened(repoPath ?? null, ORG_ACCESS_DETAIL);
      },
      QUIET,
    ),
  );

  ipcMain.handle('account:cancel-sign-in', () => {
    const target = pendingTarget();
    const detail = target ? signInDetail(target.providerId, target.host) : undefined;
    return wrapLoggedFor(
      'sign-in-browser',
      target?.repoPath ?? null,
      detail,
      async () => {
        cancelSignIn();
        lastFailure = null;
        if (target) {
          logEvent({
            op: 'sign-in-browser',
            repoPath: target.repoPath,
            status: 'info',
            detail,
            error: 'Cancelled before the browser answered',
          });
        }
      },
      QUIET,
    );
  });

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
