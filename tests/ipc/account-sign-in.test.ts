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
const verifyAgainstRemote = vi.fn<() => Promise<void>>();
const fetchAccount = vi.fn<() => Promise<unknown>>();

vi.mock('../../electron/auth/token-store', () => ({
  saveCredential: (...a: unknown[]) => saveCredential(...a),
  accountForHost: vi.fn().mockResolvedValue(null),
  clearCredential: vi.fn(),
  isPersistent: () => true,
  listAccounts: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../electron/auth/git-credentials', () => ({
  approveCredentials: (...a: unknown[]) => approveCredentials(...a),
  rejectCredentials: vi.fn(),
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
  return {
    ...actual,
    providerForHost: (host: string) =>
      host === 'github.com'
        ? { id: 'github', displayName: 'GitHub', fetchAccount: () => fetchAccount() }
        : null,
  };
});

const { registerAccountHandlers } = await import('../../electron/ipc/account');
registerAccountHandlers();

const signInToken = (host: string, login: string, token: string, repo: string | null = null) =>
  handlers.get('account:sign-in-token')!(null, host, login, token, repo) as Promise<{
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
});

describe('account:sign-in-token', () => {
  // The bug this whole path was rebuilt for: host "1-1", login "1-1",
  // token "1-1" used to produce a signed-in account and a keychain entry.
  it('refuses a made-up credential for a server it cannot check', async () => {
    const result = await signInToken('1-1', '1-1', '1-1');
    expect(result.error).toMatch(/no other way to check/i);
    storedNothing();
  });

  it('refuses a made-up credential even with a repository open', async () => {
    originUrlFor.mockResolvedValue('https://1-1/a/b.git');
    verifyAgainstRemote.mockRejectedValue(new Error('The server rejected this username and token'));

    const result = await signInToken('1-1', '1-1', '1-1', '/repo');
    expect(result.error).toMatch(/rejected/i);
    expect(verifyAgainstRemote).toHaveBeenCalledWith('https://1-1/a/b.git', '1-1', '1-1');
    storedNothing();
  });

  it('checks an unknown server against its own remote, then stores', async () => {
    originUrlFor.mockResolvedValue('https://git.example.com/a/b.git');

    const result = await signInToken('git.example.com', 'alice', 'tok', '/repo');
    expect(result.error).toBeUndefined();
    expect(verifyAgainstRemote).toHaveBeenCalledWith(
      'https://git.example.com/a/b.git',
      'alice',
      'tok',
    );
    expect(approveCredentials).toHaveBeenCalledWith('git.example.com', 'alice', 'tok');
    expect(saveCredential).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'git.example.com', host: 'git.example.com' }),
    );
  });

  // An ssh remote never carries a token, so a token proved against it proves
  // nothing — and `ls-remote` would authenticate with the user's key instead.
  it('will not check a token against an ssh remote', async () => {
    originUrlFor.mockResolvedValue('git@git.example.com:a/b.git');

    const result = await signInToken('git.example.com', 'alice', 'tok', '/repo');
    expect(result.error).toMatch(/https/i);
    expect(verifyAgainstRemote).not.toHaveBeenCalled();
    storedNothing();
  });

  it('will not check a token against a remote on a different host', async () => {
    originUrlFor.mockResolvedValue('https://elsewhere.example/a/b.git');

    const result = await signInToken('git.example.com', 'alice', 'tok', '/repo');
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
    // The API is the authority on who this is; the form is only a guess.
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

  // `git credential` reads one key=value per line from stdin, so a newline in
  // a value is a second field nobody asked for.
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
