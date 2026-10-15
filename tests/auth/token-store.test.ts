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

const repo = (host: string) => `/src/${host}`;

const account = (host: string, login = 'me', repoPath = repo(host)) => ({
  id: repoPath,
  repoPath,
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
  repoPath: repo(host),
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
    expect(await store.getFreshToken(repo('github.com'))).toBe('tok');
  });

  it('keeps several hosts side by side', async () => {
    await store.saveCredential(credential('github.com'));
    await store.saveCredential(credential('gitlab.example.com'));
    store.resetStoreCache();

    const hosts = (await store.listAccounts()).map(a => a.host).sort();
    expect(hosts).toEqual(['github.com', 'gitlab.example.com']);

    await store.clearCredential(repo('github.com'));
    store.resetStoreCache();
    expect((await store.listAccounts()).map(a => a.host)).toEqual(['gitlab.example.com']);
  });

  it('writes no file when the OS offers no encryption', async () => {
    encryption.available = false;
    await store.saveCredential(credential('github.com'));

    await expect(fs.readFile(path.join(userData.dir, 'accounts.json'))).rejects.toThrow();
    expect(store.isPersistent()).toBe(false);
    expect(await store.getFreshToken(repo('github.com'))).toBe('tok');
  });

  it('does not touch a token that is still comfortably valid', async () => {
    await store.saveCredential(
      credential('gitlab.com', { expiresAt: Date.now() + 60 * 60 * 1000, refreshToken: 'r' }),
    );
    expect(await store.getFreshToken(repo('gitlab.com'))).toBe('tok');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes a token that is about to expire and re-arms git', async () => {
    refresh.mockResolvedValue({
      accessToken: 'fresh',
      refreshToken: 'newer',
      expiresAt: Date.now() + 7200_000,
    });
    await store.saveCredential(
      credential('gitlab.com', { expiresAt: Date.now() + 60_000, refreshToken: 'r' }),
    );

    expect(await store.getFreshToken(repo('gitlab.com'))).toBe('fresh');
    expect(approve).toHaveBeenCalledWith('gitlab.com', 'me', 'fresh');

    store.resetStoreCache();
    expect(await store.getFreshToken(repo('gitlab.com'))).toBe('fresh');
  });

  it('keeps the previous refresh token when the provider sends none', async () => {
    refresh.mockResolvedValue({ accessToken: 'fresh', refreshToken: null, expiresAt: null });
    await store.saveCredential(
      credential('gitlab.com', { expiresAt: Date.now() + 60_000, refreshToken: 'keep-me' }),
    );
    await store.getFreshToken(repo('gitlab.com'));

    refresh.mockClear();
    refresh.mockResolvedValue({ accessToken: 'fresher', refreshToken: null, expiresAt: null });
    store.resetStoreCache();
    expect(await store.getFreshToken(repo('gitlab.com'))).toBe('fresh');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('reports no token when an expired one cannot be refreshed', async () => {
    await store.saveCredential(
      credential('bitbucket.org', { expiresAt: Date.now() - 1000, refreshToken: null }),
    );
    expect(await store.getFreshToken(repo('bitbucket.org'))).toBeNull();
    expect(await store.accountForRepo(repo('bitbucket.org'))).not.toBeNull();
  });

  it('keeps one account per repository, even on the same host', async () => {
    await store.saveCredential({
      ...credential('github.com'),
      repoPath: '/src/personal',
      account: account('github.com', 'personal', '/src/personal'),
      accessToken: 'tok-personal',
    });
    await store.saveCredential({
      ...credential('github.com'),
      repoPath: '/src/work',
      account: account('github.com', 'work', '/src/work'),
      accessToken: 'tok-work',
    });
    store.resetStoreCache();

    expect(await store.listAccounts()).toHaveLength(2);
    expect((await store.accountForRepo('/src/personal'))?.login).toBe('personal');
    expect(await store.getFreshToken('/src/work')).toBe('tok-work');
    expect((await store.credentialsOnHost('github.com')).map(c => c.repoPath).sort()).toEqual([
      '/src/personal',
      '/src/work',
    ]);
  });

  it('signs in again over the same repository, replacing its account', async () => {
    await store.saveCredential(credential('github.com', { accessToken: 'old' }));
    await store.saveCredential({
      ...credential('gitlab.com'),
      repoPath: repo('github.com'),
      account: account('gitlab.com', 'me', repo('github.com')),
      accessToken: 'new',
    });
    expect((await store.accountForRepo(repo('github.com')))?.host).toBe('gitlab.com');
    expect(await store.getFreshToken(repo('github.com'))).toBe('new');
  });

  it('reports no account for a host nobody signed in to', async () => {
    expect(await store.accountForRepo(repo('nowhere.example'))).toBeNull();
  });

  it('drops the host-keyed entries older builds wrote', async () => {
    const legacy = {
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
    };
    await fs.writeFile(path.join(userData.dir, 'accounts.json'), JSON.stringify([legacy]));
    store.resetStoreCache();
    expect(await store.listAccounts()).toEqual([]);

    await fs.writeFile(
      path.join(userData.dir, 'accounts.json'),
      JSON.stringify({ accounts: [{ ...legacy, id: 'github.com|octocat' }] }),
    );
    store.resetStoreCache();
    expect(await store.listAccounts()).toEqual([]);
  });

  it('reports no token for a host nobody signed in to', async () => {
    expect(await store.getFreshToken(repo('nowhere.example'))).toBeNull();
  });
});
