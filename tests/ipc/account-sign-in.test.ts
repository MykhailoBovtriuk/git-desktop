import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { shell } from 'electron';
import { HttpError } from '../../electron/auth/http';
import { resetKeyCache } from '../../electron/auth/oauth-config';
import { setLogSink } from '../../electron/log/git-logger';
import type { LogEntry } from '../../src/types';

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => Promise<unknown>) =>
      handlers.set(channel, fn),
  },
  shell: { openExternal: vi.fn() },
  BrowserWindow: class {},
}));

const saveCredential = vi.fn().mockResolvedValue(undefined);
const approveCredentials = vi.fn().mockResolvedValue(undefined);
const ensureGlobalIdentity = vi.fn().mockResolvedValue(undefined);
const accountForRepo = vi.fn<(repo: string) => Promise<unknown>>();
const credentialsOnHost = vi.fn<(host: string) => Promise<unknown[]>>();
const storedCredential =
  vi.fn<
    (q: { host: string; cwd?: string }) => Promise<{ username: string; password: string } | null>
  >();
const bindRepoUsername = vi.fn().mockResolvedValue(undefined);
const unbindRepoUsername = vi.fn().mockResolvedValue(undefined);
const fetchAccount = vi.fn<() => Promise<unknown>>();
const enterpriseFetch = vi.fn<(host: string, token: string) => Promise<unknown>>();
const enterpriseProbe = vi.fn<(host: string) => Promise<string>>();
const revokeToken = vi.fn().mockResolvedValue(undefined);
const clearCredential = vi.fn<(id: string) => Promise<unknown>>();
const rejectCredentials = vi.fn().mockResolvedValue(undefined);
const listAccounts = vi.fn<() => Promise<unknown[]>>();

vi.mock('../../electron/auth/token-store', () => ({
  saveCredential: (...a: unknown[]) => saveCredential(...a),
  accountForRepo: (repo: string) => accountForRepo(repo),
  credentialsOnHost: (host: string) => credentialsOnHost(host),
  clearCredential: (id: string) => clearCredential(id),
  isPersistent: () => true,
  listAccounts: () => listAccounts(),
}));

vi.mock('../../electron/auth/git-credentials', () => ({
  storedCredential: (q: { host: string; cwd?: string }) => storedCredential(q),
  credentialHelpersFor: vi.fn().mockResolvedValue([]),
  bindRepoUsername: (...a: unknown[]) => bindRepoUsername(...a),
  unbindRepoUsername: (...a: unknown[]) => unbindRepoUsername(...a),
  approveCredentials: (...a: unknown[]) => approveCredentials(...a),
  rejectCredentials: (...a: unknown[]) => rejectCredentials(...a),
  gitUsernameFor: (account: { login: string }) => account.login,
}));

vi.mock('../../electron/auth/identity-bootstrap', () => ({
  ensureGlobalIdentity: (...a: unknown[]) => ensureGlobalIdentity(...a),
}));

vi.mock('../../electron/auth/providers/registry', async importOriginal => {
  const actual = await importOriginal<typeof import('../../electron/auth/providers/registry')>();
  const github = {
    id: 'github',
    displayName: 'GitHub',
    fetchAccount: () => fetchAccount(),
    revokeToken: (o: unknown) => revokeToken(o),
  };
  const enterprise = {
    id: 'github-enterprise',
    displayName: 'GitHub Enterprise',
    fetchAccount: (host: string, token: string) => enterpriseFetch(host, token),
    probe: (host: string) => enterpriseProbe(host),
  };
  return {
    ...actual,
    providerForHost: (host: string) => (host === 'github.com' ? github : null),
    providerById: (id: string) =>
      id === 'github'
        ? github
        : id === 'github-enterprise'
          ? enterprise
          : actual.providerById(id as never),
  };
});

const { registerAccountHandlers } = await import('../../electron/ipc/account');
registerAccountHandlers();

const signInToken = (providerId: string, host: string, token: string, repo = '/src/p') =>
  handlers.get('account:sign-in-token')!(null, providerId, host, token, repo) as Promise<{
    data?: unknown;
    error?: string;
  }>;

const storedNothing = () => {
  expect(saveCredential).not.toHaveBeenCalled();
  expect(approveCredentials).not.toHaveBeenCalled();
  expect(ensureGlobalIdentity).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  accountForRepo.mockResolvedValue(null);
  credentialsOnHost.mockResolvedValue([]);
  storedCredential.mockResolvedValue(null);
  clearCredential.mockResolvedValue(null);
  listAccounts.mockResolvedValue([]);
});

const askAuthSource = (host: string | null, protocol: string | null, repo = '/src/p') =>
  handlers.get('account:auth-source')!(null, host, protocol, repo) as Promise<{ data?: string }>;

describe('account:auth-source', () => {
  it("reports the repository's own account first", async () => {
    accountForRepo.mockResolvedValue({ host: 'github.com' });
    expect((await askAuthSource('github.com', 'https')).data).toBe('account');
    expect(accountForRepo).toHaveBeenCalledWith('/src/p');
  });

  it('does not count an account for another server', async () => {
    accountForRepo.mockResolvedValue({ host: 'gitlab.com' });
    expect((await askAuthSource('github.com', 'https')).data).toBe('none');
  });

  it('settles ssh without touching the keychain', async () => {
    expect((await askAuthSource('github.com', 'ssh')).data).toBe('ssh');
    expect(storedCredential).not.toHaveBeenCalled();
  });

  it('reports a login git finds on its own, like a terminal sign-in', async () => {
    storedCredential.mockResolvedValue({ username: 'octocat', password: 'tok' });
    expect((await askAuthSource('github.com', 'https')).data).toBe('system');
  });

  it('asks from inside the repository, as the identity lookup does', async () => {
    await askAuthSource('github.com', 'https');
    expect(storedCredential).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'github.com', cwd: '/src/p' }),
    );
  });

  it("does not take another repository's sign-in for this one's", async () => {
    storedCredential.mockResolvedValue({ username: 'octocat', password: 'tok' });
    credentialsOnHost.mockResolvedValue([
      { repoPath: '/src/other', account: { login: 'octocat' } },
    ]);
    expect((await askAuthSource('github.com', 'https')).data).toBe('none');
  });

  it('reports nothing at all when no credential exists', async () => {
    expect((await askAuthSource('github.com', 'https')).data).toBe('none');
  });

  it('reports nothing for a repository with no remote', async () => {
    expect((await askAuthSource(null, null)).data).toBe('none');
    expect(storedCredential).not.toHaveBeenCalled();
  });
});

describe('account:sign-in-token', () => {
  it("asks the service's API who the token belongs to, and keeps the answer", async () => {
    fetchAccount.mockResolvedValue({
      providerId: 'github',
      host: 'github.com',
      displayName: 'GitHub',
      login: 'real-login',
      name: 'Real Name',
      email: 'real@example.com',
      avatarDataUrl: null,
    });

    const result = await signInToken('github', 'github.com', 'tok');
    expect(result.error).toBeUndefined();
    expect(result.data).toMatchObject({ login: 'real-login', name: 'Real Name' });
    expect(approveCredentials).toHaveBeenCalledWith('github.com', 'real-login', 'tok');
    expect(saveCredential).toHaveBeenCalledWith(
      expect.objectContaining({ repoPath: '/src/p', host: 'github.com' }),
    );
    expect(bindRepoUsername).toHaveBeenCalledWith('/src/p', 'github.com', 'real-login');
  });

  it('reports a token the service rejects, and stores nothing', async () => {
    fetchAccount.mockRejectedValue(new HttpError('https://api.github.com/user returned 401', 401));

    const result = await signInToken('github', 'github.com', '1-1');
    expect(result.error).toBe('GitHub rejected this token');
    storedNothing();
  });

  it('does not mistake an unreachable host for a bad token', async () => {
    fetchAccount.mockRejectedValue(new Error('fetch failed'));

    const result = await signInToken('github', 'github.com', 'tok');
    expect(result.error).toMatch(/could not check/i);
    storedNothing();
  });

  it('rejects a line break in the token', async () => {
    expect((await signInToken('github', 'github.com', 'tok\nhost=evil')).error).toMatch(
      /line break/,
    );
    storedNothing();
  });

  it('asks a self-hosted service at its own address', async () => {
    enterpriseFetch.mockResolvedValue({
      providerId: 'github-enterprise',
      host: 'ghe.acme.com',
      displayName: 'GitHub Enterprise',
      login: 'jane',
      name: 'Jane',
      email: 'jane@acme.com',
      avatarDataUrl: null,
    });

    const result = await signInToken('github-enterprise', 'ghe.acme.com', 'tok');
    expect(result.error).toBeUndefined();
    expect(enterpriseFetch).toHaveBeenCalledWith('ghe.acme.com', 'tok');
    expect(approveCredentials).toHaveBeenCalledWith('ghe.acme.com', 'jane', 'tok');
  });

  it.each(['token', 'bitbucket', 'gitea', 'nope'])('refuses the unknown service %s', async id => {
    const result = await signInToken(id, 'git.example.com', 'tok');
    expect(result.error).toMatch(/Unknown provider/);
    storedNothing();
  });
});

describe('account:probe-server', () => {
  const probeServer = (providerId: string, host: string) =>
    handlers.get('account:probe-server')!(null, providerId, host) as Promise<{
      data?: string;
      error?: string;
    }>;

  it("passes on the service's own answer", async () => {
    enterpriseProbe.mockResolvedValue('mismatch');
    expect((await probeServer('github-enterprise', 'gitlab.acme.com')).data).toBe('mismatch');
    expect(enterpriseProbe).toHaveBeenCalledWith('gitlab.acme.com');
  });

  it('has nothing to ask a service without a probe', async () => {
    expect((await probeServer('github', 'github.com')).data).toBe('ok');
  });

  it('refuses something that is not a hostname', async () => {
    expect((await probeServer('github-enterprise', 'evil.com/path')).error).toMatch(/hostname/);
  });
});

describe('account:sign-out', () => {
  const signOut = (repo: unknown) =>
    handlers.get('account:sign-out')!(null, repo) as Promise<{ error?: string }>;

  const stored = (repoPath: string, token: string) => ({
    repoPath,
    host: 'github.com',
    account: { providerId: 'github', login: 'octocat' },
    accessToken: token,
    clientId: 'cid',
    clientSecret: 'sec',
  });

  it('signs the repository out: config, keychain and token', async () => {
    clearCredential.mockResolvedValue(stored('/src/p', 'tok'));

    expect((await signOut('/src/p')).error).toBeUndefined();
    expect(clearCredential).toHaveBeenCalledWith('/src/p');
    expect(unbindRepoUsername).toHaveBeenCalledWith('/src/p', 'github.com');
    expect(rejectCredentials).toHaveBeenCalledWith('github.com', 'octocat');
    expect(revokeToken).toHaveBeenCalledWith({
      host: 'github.com',
      token: 'tok',
      clientId: 'cid',
      clientSecret: 'sec',
    });
  });

  it('keeps the keychain entry another repository still uses', async () => {
    clearCredential.mockResolvedValue(stored('/src/p', 'tok'));
    credentialsOnHost.mockResolvedValue([stored('/src/other', 'tok-other')]);

    await signOut('/src/p');
    expect(rejectCredentials).not.toHaveBeenCalled();
    expect(approveCredentials).toHaveBeenCalledWith('github.com', 'octocat', 'tok-other');
  });

  it('does nothing more for a repository with no account', async () => {
    expect((await signOut('/nowhere')).error).toBeUndefined();
    expect(rejectCredentials).not.toHaveBeenCalled();
    expect(revokeToken).not.toHaveBeenCalled();
  });

  it('refuses something that is not a repository path', async () => {
    expect((await signOut('relative/path')).error).toMatch(/absolute/);
    expect(clearCredential).not.toHaveBeenCalled();
  });
});

describe('forgetRepoAccount', () => {
  it('signs the repository out', async () => {
    const { forgetRepoAccount } = await import('../../electron/ipc/account');
    clearCredential.mockResolvedValue({
      repoPath: '/src/p',
      host: 'github.com',
      account: { providerId: 'github', login: 'octocat' },
      accessToken: 'tok',
      clientId: '',
      clientSecret: null,
    });
    await forgetRepoAccount('/src/p');
    expect(unbindRepoUsername).toHaveBeenCalledWith('/src/p', 'github.com');
    expect(rejectCredentials).toHaveBeenCalledWith('github.com', 'octocat');
  });
});

describe('logging of calls the renderer falls back from', () => {
  let seen: LogEntry[];
  beforeEach(() => {
    seen = [];
    setLogSink(e => seen.push(e));
  });
  afterEach(() => setLogSink(() => {}));

  it('logs nothing when the account list loads', async () => {
    expect(await handlers.get('account:list')!(null)).toMatchObject({ data: { accounts: [] } });
    expect(seen).toEqual([]);
  });

  it('logs an account list that fails to load, with its id in the reply', async () => {
    listAccounts.mockRejectedValue(new Error('accounts.json is unreadable'));
    const result = (await handlers.get('account:list')!(null)) as { logId?: string };
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ op: 'accounts-load', status: 'error', repoPath: null });
    expect(seen[0].error).toContain('unreadable');
    expect(result.logId).toBe(seen[0].id);
  });

  it('logs nothing when no browser sign-in was waiting to be cancelled', async () => {
    expect(await handlers.get('account:cancel-sign-in')!(null)).toEqual({ data: null });
    expect(seen).toEqual([]);
  });

  it('records a browser sign-in cancelled before the browser answered', async () => {
    await handlers.get('account:sign-in')!(null, 'gitlab', 'gitlab.com', '/src/p', 'id', 'secret');
    seen.length = 0;
    await handlers.get('account:cancel-sign-in')!(null);
    expect(seen).toEqual([
      expect.objectContaining({
        op: 'sign-in-browser',
        repoPath: '/src/p',
        status: 'info',
        detail: 'gitlab · gitlab.com',
      }),
    ]);
  });
});

describe('logging of opened help pages', () => {
  let seen: LogEntry[];
  beforeEach(() => {
    seen = [];
    setLogSink(e => seen.push(e));
  });
  afterEach(() => setLogSink(() => {}));

  it('records the organization approval page it opened', async () => {
    await handlers.get('account:open-org-access')!(null, '/src/p');
    expect(seen).toEqual([
      expect.objectContaining({
        op: 'sign-in-browser',
        repoPath: '/src/p',
        status: 'info',
        detail: 'github · github.com · org access',
      }),
    ]);
  });

  it('records the token help page it opened', async () => {
    await handlers.get('account:open-token-help')!(null, 'gitlab', 'gitlab.com');
    expect(seen).toEqual([
      expect.objectContaining({
        op: 'sign-in-browser',
        repoPath: null,
        status: 'info',
        detail: 'gitlab · gitlab.com · token help',
      }),
    ]);
  });

  it('records a page that would not open as a failure, with no info entry', async () => {
    vi.mocked(shell.openExternal).mockRejectedValueOnce(new Error('no browser'));
    const result = (await handlers.get('account:open-org-access')!(null, '/src/p')) as {
      logId?: string;
    };
    expect(seen).toEqual([expect.objectContaining({ status: 'error', id: result.logId })]);
  });
});

describe('account:open-org-access', () => {
  const open = (repo: unknown = '/src/p') => handlers.get('account:open-org-access')!(null, repo);
  const keys = { ...process.env };

  afterEach(() => {
    process.env = { ...keys };
    resetKeyCache();
  });

  it('opens the approval page of the baked-in GitHub app', async () => {
    process.env.OAUTH_GITHUB_ID = 'Ov23liAbc';
    process.env.OAUTH_GITHUB_SECRET = 's';
    await open();
    expect(shell.openExternal).toHaveBeenCalledWith(
      'https://github.com/settings/connections/applications/Ov23liAbc',
    );
  });

  it('falls back to the list of authorized apps without a client id', async () => {
    process.env.OAUTH_GITHUB_ID = '';
    await open();
    expect(shell.openExternal).toHaveBeenCalledWith('https://github.com/settings/applications');
  });

  it('never builds a path from a client id that is not one', async () => {
    process.env.OAUTH_GITHUB_ID = '../../evil';
    process.env.OAUTH_GITHUB_SECRET = 's';
    await open();
    expect(shell.openExternal).toHaveBeenCalledWith('https://github.com/settings/applications');
  });

  it('refuses a repository path that is not one', async () => {
    expect(await open('relative/path')).toMatchObject({ error: expect.any(String) });
    expect(shell.openExternal).not.toHaveBeenCalled();
  });
});
