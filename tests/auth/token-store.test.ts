import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const userData = { dir: '' };
const encryption = { available: true };

vi.mock('electron', () => ({
  app: { getPath: () => userData.dir },
  safeStorage: {
    isEncryptionAvailable: () => encryption.available,
    // Reversible stand-in for the OS keychain: the point of these tests is the
    // store's behaviour, not Chromium's crypto.
    encryptString: (s: string) => Buffer.from(`enc:${s}`),
    decryptString: (b: Buffer) => {
      const raw = b.toString();
      if (!raw.startsWith('enc:')) throw new Error('not ours');
      return raw.slice(4);
    },
  },
}));

const approve = vi.fn().mockResolvedValue(undefined);
vi.mock('../../electron/auth/git-credentials', () => ({
  approveCredentials: (...args: unknown[]) => approve(...args),
  gitUsernameFor: (a: { login: string }) => a.login,
}));

const refresh = vi.fn();
vi.mock('../../electron/auth/oauth-flow', () => ({
  refreshToken: (...args: unknown[]) => refresh(...args),
}));

const store = await import('../../electron/auth/token-store');

const account = (host: string, login = 'me') => ({
  id: host,
  providerId: 'github' as const,
  host,
  displayName: 'GitHub',
  login,
  name: 'Me',
  email: 'me@example.com',
  avatarDataUrl: null,
});

type Credential = Parameters<typeof store.saveCredential>[0];

const credential = (host: string, over: Partial<Credential> = {}): Credential => ({
  id: host,
  host,
  account: account(host),
  accessToken: 'tok',
  refreshToken: null,
  expiresAt: null,
  clientId: 'cid',
  clientSecret: null,
  ...over,
});

describe('token store', () => {
  beforeEach(async () => {
    userData.dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gd-accounts-'));
    encryption.available = true;
    approve.mockClear();
    refresh.mockReset();
    store.resetStoreCache();
  });

  afterEach(async () => {
    await fs.rm(userData.dir, { recursive: true, force: true });
  });

  it('round-trips an account through the file', async () => {
    await store.saveCredential(credential('github.com'));
    store.resetStoreCache();
    expect(await store.listAccounts()).toEqual([account('github.com')]);
    expect(await store.getFreshToken('github.com')).toBe('tok');
  });

  // Signing in to a work GitLab must not sign you out of github.com.
  it('keeps several hosts side by side', async () => {
    await store.saveCredential(credential('github.com'));
    await store.saveCredential(credential('gitlab.example.com'));
    store.resetStoreCache();

    const hosts = (await store.listAccounts()).map(a => a.host).sort();
    expect(hosts).toEqual(['github.com', 'gitlab.example.com']);

    await store.clearCredential('github.com');
    store.resetStoreCache();
    expect((await store.listAccounts()).map(a => a.host)).toEqual(['gitlab.example.com']);
  });

  // A plaintext token in a JSON file under the user's home is worse than
  // asking them to sign in again, so nothing is written at all.
  it('writes no file when the OS offers no encryption', async () => {
    encryption.available = false;
    await store.saveCredential(credential('github.com'));

    await expect(fs.readFile(path.join(userData.dir, 'accounts.json'))).rejects.toThrow();
    expect(store.isPersistent()).toBe(false);
    // Still usable for this session — just not across restarts.
    expect(await store.getFreshToken('github.com')).toBe('tok');
  });

  it('does not touch a token that is still comfortably valid', async () => {
    await store.saveCredential(
      credential('gitlab.com', { expiresAt: Date.now() + 60 * 60 * 1000, refreshToken: 'r' }),
    );
    expect(await store.getFreshToken('gitlab.com')).toBe('tok');
    expect(refresh).not.toHaveBeenCalled();
  });

  // Bitbucket and GitLab tokens last two hours. Without this the session
  // starts working and quietly stops mid-afternoon.
  it('refreshes a token that is about to expire and re-arms git', async () => {
    refresh.mockResolvedValue({
      accessToken: 'fresh',
      refreshToken: 'newer',
      expiresAt: Date.now() + 7200_000,
    });
    await store.saveCredential(
      credential('gitlab.com', { expiresAt: Date.now() + 60_000, refreshToken: 'r' }),
    );

    expect(await store.getFreshToken('gitlab.com')).toBe('fresh');
    expect(approve).toHaveBeenCalledWith('gitlab.com', 'me', 'fresh');

    store.resetStoreCache();
    expect(await store.getFreshToken('gitlab.com')).toBe('fresh');
  });

  // Some providers rotate refresh tokens and some do not; dropping the old one
  // when none arrives would strand the account on its next refresh.
  it('keeps the previous refresh token when the provider sends none', async () => {
    refresh.mockResolvedValue({ accessToken: 'fresh', refreshToken: null, expiresAt: null });
    await store.saveCredential(
      credential('gitlab.com', { expiresAt: Date.now() + 60_000, refreshToken: 'keep-me' }),
    );
    await store.getFreshToken('gitlab.com');

    refresh.mockClear();
    refresh.mockResolvedValue({ accessToken: 'fresher', refreshToken: null, expiresAt: null });
    store.resetStoreCache();
    // expiresAt is now null, so nothing should be refreshed a second time.
    expect(await store.getFreshToken('gitlab.com')).toBe('fresh');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('reports no token when an expired one cannot be refreshed', async () => {
    await store.saveCredential(
      credential('bitbucket.org', { expiresAt: Date.now() - 1000, refreshToken: null }),
    );
    expect(await store.getFreshToken('bitbucket.org')).toBeNull();
    // The entry stays, so the UI can still name the account it is asking about.
    expect(await store.accountForHost('bitbucket.org')).not.toBeNull();
  });

  // `git credential` is addressed by protocol and host, and nothing here ever
  // rewrites a remote URL to carry a username — so a second account on a host
  // is one git could never be told to prefer. Signing in again replaces it.
  it('holds one account per host, the newest one', async () => {
    await store.saveCredential({
      ...credential('github.com'),
      account: account('github.com', 'personal'),
      accessToken: 'tok-personal',
    });
    await store.saveCredential({
      ...credential('github.com'),
      account: account('github.com', 'work'),
      accessToken: 'tok-work',
    });
    store.resetStoreCache();

    expect(await store.listAccounts()).toHaveLength(1);
    expect((await store.accountForHost('github.com'))?.login).toBe('work');
    expect(await store.getFreshToken('github.com')).toBe('tok-work');
  });

  it('reports no account for a host nobody signed in to', async () => {
    expect(await store.accountForHost('nowhere.example')).toBeNull();
  });

  // Upgrading must not sign the user out: the previous build wrote a bare
  // array keyed by host, with no id on the entries.
  it('reads the host-keyed file an older build wrote', async () => {
    const legacy = [
      {
        host: 'github.com',
        account: {
          providerId: 'github',
          host: 'github.com',
          displayName: 'GitHub',
          login: 'octocat',
          name: 'Octo',
          email: 'o@x',
          avatarDataUrl: null,
        },
        accessTokenEnc: Buffer.from('enc:legacy-token').toString('base64'),
        refreshTokenEnc: null,
        expiresAt: null,
        clientId: 'cid',
        clientSecret: null,
      },
    ];
    await fs.writeFile(path.join(userData.dir, 'accounts.json'), JSON.stringify(legacy));
    store.resetStoreCache();

    const accounts = await store.listAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe('github.com');
    expect(await store.getFreshToken('github.com')).toBe('legacy-token');
  });

  // The build in between keyed accounts by `host|login` and kept a map of
  // repository bindings. Both collapse to one account per host rather than
  // signing the user out on upgrade.
  it('collapses the host|login file a later build wrote', async () => {
    const entry = (login: string, token: string) => ({
      id: `github.com|${login}`,
      host: 'github.com',
      account: {
        providerId: 'github',
        host: 'github.com',
        displayName: 'GitHub',
        login,
        name: login,
        email: `${login}@x`,
        avatarDataUrl: null,
      },
      accessTokenEnc: Buffer.from(`enc:${token}`).toString('base64'),
      refreshTokenEnc: null,
      expiresAt: null,
      clientId: 'cid',
      clientSecret: null,
    });
    await fs.writeFile(
      path.join(userData.dir, 'accounts.json'),
      JSON.stringify({
        accounts: [entry('personal', 'tok-personal'), entry('work', 'tok-work')],
        bindings: { '/src/project': 'github.com|work' },
      }),
    );
    store.resetStoreCache();

    const accounts = await store.listAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe('github.com');
    expect(accounts[0].login).toBe('personal');
    expect(await store.getFreshToken('github.com')).toBe('tok-personal');
  });

  it('reports no token for a host nobody signed in to', async () => {
    expect(await store.getFreshToken('nowhere.example')).toBeNull();
  });
});
