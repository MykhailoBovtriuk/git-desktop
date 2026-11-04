import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const takeUnsupportedCredentials = vi.fn<() => Promise<unknown[]>>();
const credentialsOnHost = vi.fn<(host: string) => Promise<unknown[]>>();
vi.mock('../../electron/auth/token-store', () => ({
  takeUnsupportedCredentials: () => takeUnsupportedCredentials(),
  credentialsOnHost: (host: string) => credentialsOnHost(host),
}));

const approveCredentials = vi.fn().mockResolvedValue(undefined);
const rejectCredentials = vi.fn().mockResolvedValue(undefined);
const unbindRepoUsername = vi.fn().mockResolvedValue(undefined);
vi.mock('../../electron/auth/git-credentials', () => ({
  approveCredentials: (...a: unknown[]) => approveCredentials(...a),
  rejectCredentials: (...a: unknown[]) => rejectCredentials(...a),
  unbindRepoUsername: (...a: unknown[]) => unbindRepoUsername(...a),
  gitUsernameFor: (account: { login: string }) => account.login,
}));

const logEvent = vi.fn();
vi.mock('../../electron/log/git-logger', () => ({
  logEvent: (...a: unknown[]) => logEvent(...a),
}));

const { dropUnsupportedAccounts } = await import('../../electron/auth/legacy-cleanup');

const stored = (providerId: string, host: string, repoPath: string, login = 'jane') => ({
  repoPath,
  host,
  account: { providerId, host, login, repoPath },
  accessToken: `tok-${providerId}`,
});

describe('dropUnsupportedAccounts', () => {
  let repo: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    repo = await fs.mkdtemp(path.join(os.tmpdir(), 'gd-drop-'));
    credentialsOnHost.mockResolvedValue([]);
  });

  afterEach(async () => {
    await fs.rm(repo, { recursive: true, force: true });
  });

  it('erases the stored token and the repository binding, and says so in the log', async () => {
    takeUnsupportedCredentials.mockResolvedValue([stored('bitbucket', 'bitbucket.org', repo)]);

    await dropUnsupportedAccounts();

    expect(rejectCredentials).toHaveBeenCalledWith('bitbucket.org', 'jane');
    expect(approveCredentials).not.toHaveBeenCalled();
    expect(unbindRepoUsername).toHaveBeenCalledWith(repo, 'bitbucket.org');
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent.mock.calls[0][0]).toMatchObject({
      op: 'account-drop',
      repoPath: null,
      status: 'warning',
      detail: `bitbucket · bitbucket.org · ${repo}`,
    });
    expect(logEvent.mock.calls[0][0].error).toMatch(/not revoked/);
  });

  it('puts back the token of a supported account that shares the login', async () => {
    takeUnsupportedCredentials.mockResolvedValue([stored('token', 'git.acme.com', repo)]);
    credentialsOnHost.mockResolvedValue([stored('github-enterprise', 'git.acme.com', '/src/b')]);

    await dropUnsupportedAccounts();

    expect(rejectCredentials).not.toHaveBeenCalled();
    expect(approveCredentials).toHaveBeenCalledWith(
      'git.acme.com',
      'jane',
      'tok-github-enterprise',
    );
  });

  it('leaves the config of a repository that no longer exists alone', async () => {
    const gone = path.join(repo, 'gone');
    takeUnsupportedCredentials.mockResolvedValue([stored('gitea', 'codeberg.org', gone)]);

    await dropUnsupportedAccounts();

    expect(rejectCredentials).toHaveBeenCalledWith('codeberg.org', 'jane');
    expect(unbindRepoUsername).not.toHaveBeenCalled();
  });

  it('goes on with the next account when one fails', async () => {
    takeUnsupportedCredentials.mockResolvedValue([
      stored('gitea', 'codeberg.org', repo),
      stored('bitbucket', 'bitbucket.org', repo),
    ]);
    credentialsOnHost.mockRejectedValueOnce(new Error('boom'));

    await dropUnsupportedAccounts();

    expect(rejectCredentials).toHaveBeenCalledWith('bitbucket.org', 'jane');
    expect(logEvent.mock.calls.map(c => c[0].error)).toEqual([
      expect.objectContaining({ message: 'boom' }),
      expect.stringMatching(/no longer supports/),
    ]);
  });

  it('does nothing when there is nothing to drop', async () => {
    takeUnsupportedCredentials.mockResolvedValue([]);
    await dropUnsupportedAccounts();
    expect(rejectCredentials).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });
});
