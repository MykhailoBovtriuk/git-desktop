import { describe, it, expect, beforeEach, vi } from 'vitest';

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
const originUrlFor = vi.fn<(repo: string) => Promise<string | null>>();
const accountForRepo = vi.fn<(repo: string) => Promise<unknown>>();
const credentialsOnHost = vi.fn<(host: string) => Promise<unknown[]>>();
const storedUsername = vi.fn<(host: string) => Promise<string | null>>();
const bindRepoUsername = vi.fn().mockResolvedValue(undefined);
const unbindRepoUsername = vi.fn().mockResolvedValue(undefined);
const verifyAgainstRemote = vi.fn<() => Promise<void>>();
const fetchAccount = vi.fn<() => Promise<unknown>>();
const enterpriseFetch = vi.fn<(host: string, token: string) => Promise<unknown>>();
const enterpriseProbe = vi.fn<(host: string) => Promise<string>>();
const revokeToken = vi.fn().mockResolvedValue(undefined);
const clearCredential = vi.fn<(id: string) => Promise<unknown>>();
const rejectCredentials = vi.fn().mockResolvedValue(undefined);

vi.mock('../../electron/auth/token-store', () => ({
  saveCredential: (...a: unknown[]) => saveCredential(...a),
  accountForRepo: (repo: string) => accountForRepo(repo),
  credentialsOnHost: (host: string) => credentialsOnHost(host),
  clearCredential: (id: string) => clearCredential(id),
  isPersistent: () => true,
  listAccounts: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../electron/auth/git-credentials', () => ({
  storedUsername: (host: string) => storedUsername(host),
  bindRepoUsername: (...a: unknown[]) => bindRepoUsername(...a),
  unbindRepoUsername: (...a: unknown[]) => unbindRepoUsername(...a),
  approveCredentials: (...a: unknown[]) => approveCredentials(...a),
  rejectCredentials: (...a: unknown[]) => rejectCredentials(...a),
  listCredentialHelpers: vi.fn().mockResolvedValue([]),
  gitUsernameFor: (account: { login: string }) => account.login,
}));

vi.mock('../../electron/auth/identity-bootstrap', () => ({
  ensureGlobalIdentity: (...a: unknown[]) => ensureGlobalIdentity(...a),
}));

vi.mock('../../electron/auth/verify-credential', () => ({
  verifyAgainstRemote: (...a: unknown[]) => verifyAgainstRemote(...(a as [])),
}));

vi.mock('../../electron/auth/remote-host', async importOriginal => {
  const actual = await importOriginal<typeof import('../../electron/auth/remote-host')>();
  return { ...actual, originUrlFor: (repo: string) => originUrlFor(repo) };
});

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

const signInToken = (
  host: string,
  login: string,
  token: string,
  repo = '/src/p',
  providerId = 'token',
) =>
  handlers.get('account:sign-in-token')!(null, providerId, host, login, token, repo) as Promise<{
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
  originUrlFor.mockResolvedValue(null);
  verifyAgainstRemote.mockResolvedValue(undefined);
  accountForRepo.mockResolvedValue(null);
  credentialsOnHost.mockResolvedValue([]);
  storedUsername.mockResolvedValue(null);
  clearCredential.mockResolvedValue(null);
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
    expect(storedUsername).not.toHaveBeenCalled();
  });

  it('reports a login git finds on its own, like a terminal sign-in', async () => {
    storedUsername.mockResolvedValue('octocat');
    expect((await askAuthSource('github.com', 'https')).data).toBe('system');
  });

  it("does not take another repository's sign-in for this one's", async () => {
    storedUsername.mockResolvedValue('octocat');
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
    expect(storedUsername).not.toHaveBeenCalled();
  });
});

describe('account:sign-in-token', () => {
  it('refuses a made-up credential for a server it cannot check', async () => {
    const result = await signInToken('1-1', '1-1', '1-1');
    expect(result.error).toMatch(/no other way to check/i);
    storedNothing();
  });

  it('refuses a made-up credential even with a repository open', async () => {
    originUrlFor.mockResolvedValue('https://1-1/a/b.git');
    verifyAgainstRemote.mockRejectedValue(new Error('The server rejected this username and token'));

    const result = await signInToken('1-1', '1-1', '1-1');
    expect(result.error).toMatch(/rejected/i);
    expect(verifyAgainstRemote).toHaveBeenCalledWith('https://1-1/a/b.git', '1-1', '1-1');
    storedNothing();
  });

  it('checks an unknown server against its own remote, then stores', async () => {
    originUrlFor.mockResolvedValue('https://git.example.com/a/b.git');

    const result = await signInToken('git.example.com', 'alice', 'tok');
    expect(result.error).toBeUndefined();
    expect(verifyAgainstRemote).toHaveBeenCalledWith(
      'https://git.example.com/a/b.git',
      'alice',
      'tok',
    );
    expect(approveCredentials).toHaveBeenCalledWith('git.example.com', 'alice', 'tok');
    expect(saveCredential).toHaveBeenCalledWith(
      expect.objectContaining({ repoPath: '/src/p', host: 'git.example.com' }),
    );
    expect(bindRepoUsername).toHaveBeenCalledWith('/src/p', 'git.example.com', 'alice');
  });

  it('will not check a token against an ssh remote', async () => {
    originUrlFor.mockResolvedValue('git@git.example.com:a/b.git');

    const result = await signInToken('git.example.com', 'alice', 'tok');
    expect(result.error).toMatch(/https/i);
    expect(verifyAgainstRemote).not.toHaveBeenCalled();
    storedNothing();
  });

  it('will not check a token against a remote on a different host', async () => {
    originUrlFor.mockResolvedValue('https://elsewhere.example/a/b.git');

    const result = await signInToken('git.example.com', 'alice', 'tok');
    expect(result.error).toBeDefined();
    expect(verifyAgainstRemote).not.toHaveBeenCalled();
    storedNothing();
  });

  it('asks a known host its API instead, and keeps the answer', async () => {
    fetchAccount.mockResolvedValue({
      providerId: 'github',
      host: 'github.com',
      displayName: 'GitHub',
      login: 'real-login',
      name: 'Real Name',
      email: 'real@example.com',
      avatarDataUrl: null,
    });

    const result = await signInToken('github.com', 'whatever-they-typed', 'tok');
    expect(result.error).toBeUndefined();
    expect(result.data).toMatchObject({ login: 'real-login', name: 'Real Name' });
    expect(verifyAgainstRemote).not.toHaveBeenCalled();
    expect(approveCredentials).toHaveBeenCalledWith('github.com', 'real-login', 'tok');
  });

  it('reports a token a known host rejects, and stores nothing', async () => {
    fetchAccount.mockRejectedValue(new Error('https://api.github.com/user returned 401'));

    const result = await signInToken('github.com', 'alice', '1-1');
    expect(result.error).toBe('GitHub rejected this token');
    storedNothing();
  });

  it('does not mistake an unreachable host for a bad token', async () => {
    fetchAccount.mockRejectedValue(new Error('fetch failed'));

    const result = await signInToken('github.com', 'alice', 'tok');
    expect(result.error).toMatch(/could not check/i);
    storedNothing();
  });

  it('rejects a line break in the username or token', async () => {
    expect((await signInToken('git.example.com', 'alice\npassword=x', 'tok')).error).toMatch(
      /line break/,
    );
    expect((await signInToken('git.example.com', 'alice', 'tok\nhost=evil')).error).toMatch(
      /line break/,
    );
    storedNothing();
  });
});

describe('account:sign-in-token with a chosen service', () => {
  it('asks the chosen service its API, with no username typed', async () => {
    enterpriseFetch.mockResolvedValue({
      providerId: 'github-enterprise',
      host: 'ghe.acme.com',
      displayName: 'GitHub Enterprise',
      login: 'jane',
      name: 'Jane',
      email: 'jane@acme.com',
      avatarDataUrl: null,
    });

    const result = await signInToken('ghe.acme.com', '', 'tok', '/src/p', 'github-enterprise');
    expect(result.error).toBeUndefined();
    expect(enterpriseFetch).toHaveBeenCalledWith('ghe.acme.com', 'tok');
    expect(verifyAgainstRemote).not.toHaveBeenCalled();
    expect(approveCredentials).toHaveBeenCalledWith('ghe.acme.com', 'jane', 'tok');
  });

  it('still needs a username for a bare Git server', async () => {
    const result = await signInToken('git.example.com', '', 'tok');
    expect(result.error).toMatch(/login/);
    storedNothing();
  });

  it('refuses an unknown service', async () => {
    const result = await signInToken('git.example.com', 'a', 'tok', '/src/p', 'nope');
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

  it('has nothing to ask a bare Git server', async () => {
    expect((await probeServer('token', 'git.example.com')).data).toBe('ok');
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
