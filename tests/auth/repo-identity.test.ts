import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpError } from '../../electron/auth/http';
import { logged, setLogSink } from '../../electron/log/git-logger';
import type { LogEntry } from '../../src/types';

const TOKEN = 'gho_secret_token';

let remoteUrl = 'https://github.com/a/b.git';
let sshCommandConfig: string | null = null;
let sshStderr = '';
const spawned: { file: string; args: string[] }[] = [];

vi.mock('child_process', () => ({
  execFile: (
    file: string,
    args: string[],
    _options: unknown,
    cb: (err: Error | null, stdout: string, stderr: string) => void,
  ) => {
    spawned.push({ file, args });
    const tail = args.slice(2).join(' ');
    queueMicrotask(() => {
      if (file !== 'git') return cb(new Error('exit 1'), '', sshStderr);
      if (tail === 'remote') return cb(null, 'origin\n', '');
      if (tail === 'remote get-url --push origin') return cb(null, `${remoteUrl}\n`, '');
      if (tail === 'config --get core.sshCommand') {
        return sshCommandConfig ? cb(null, sshCommandConfig, '') : cb(new Error('exit 1'), '', '');
      }
      cb(new Error(`unexpected git ${tail}`), '', '');
    });
    return {};
  },
}));

const accountForRepo = vi.fn<(repo: string) => Promise<unknown>>();
const credentialsOnHost = vi.fn<(host: string) => Promise<unknown[]>>();
vi.mock('../../electron/auth/token-store', () => ({
  accountForRepo: (repo: string) => accountForRepo(repo),
  credentialsOnHost: (host: string) => credentialsOnHost(host),
}));

const storedCredential = vi.fn();
const OSXKEYCHAIN = { url: null, helper: 'osxkeychain', scope: 'global', cli: null };
const credentialHelpersFor = vi.fn<() => Promise<unknown[]>>();
vi.mock('../../electron/auth/git-credentials', () => ({
  storedCredential: (...a: unknown[]) => storedCredential(...a),
  credentialHelpersFor: () => credentialHelpersFor(),
  gitUsernameFor: (account: { login: string }) => account.login,
}));

const fetchAccount = vi.fn<(host: string, token: string) => Promise<unknown>>();
vi.mock('../../electron/auth/providers/registry', () => ({
  providerForHost: (host: string) =>
    host === 'github.com'
      ? {
          id: 'github',
          displayName: 'GitHub',
          fetchAccount: (h: string, t: string) => fetchAccount(h, t),
        }
      : null,
}));

const { resolveIdentity, clearIdentityCache } = await import('../../electron/auth/repo-identity');

const entries: LogEntry[] = [];
setLogSink(e => entries.push(e));

const identify = (repo = '/src/p') =>
  logged('account-profile', repo, undefined, () => resolveIdentity(repo), { quiet: true });

const profile = {
  providerId: 'github',
  host: 'github.com',
  displayName: 'GitHub',
  login: 'octocat',
  name: 'The Octocat',
  email: 'octo@example.com',
  avatarDataUrl: 'data:image/png;base64,AA',
};

beforeEach(() => {
  vi.clearAllMocks();
  clearIdentityCache();
  entries.length = 0;
  spawned.length = 0;
  remoteUrl = 'https://github.com/a/b.git';
  sshCommandConfig = null;
  sshStderr = '';
  accountForRepo.mockResolvedValue(null);
  credentialsOnHost.mockResolvedValue([]);
  storedCredential.mockResolvedValue({ username: 'octocat', password: TOKEN });
  credentialHelpersFor.mockResolvedValue([OSXKEYCHAIN]);
  fetchAccount.mockResolvedValue(profile);
});

describe('resolveIdentity over https', () => {
  it('asks the service who the stored credential belongs to', async () => {
    await expect(identify()).resolves.toEqual({
      source: 'system',
      host: 'github.com',
      login: 'octocat',
      name: 'The Octocat',
      avatarDataUrl: 'data:image/png;base64,AA',
      ssh: null,
      helpers: [OSXKEYCHAIN],
      profile: 'ok',
    });
    expect(storedCredential).toHaveBeenCalledWith({
      host: 'github.com',
      path: 'a/b.git',
      username: null,
      cwd: '/src/p',
    });
    expect(fetchAccount).toHaveBeenCalledWith('github.com', TOKEN);
  });

  it('prefers the account the app signed this repository in with', async () => {
    accountForRepo.mockResolvedValue({ ...profile, repoPath: '/src/p' });
    const identity = await identify();
    expect(identity.source).toBe('account');
    expect(identity.login).toBe('octocat');
    expect(storedCredential).not.toHaveBeenCalled();
  });

  it("does not take another repository's sign-in for this one's", async () => {
    credentialsOnHost.mockResolvedValue([
      { repoPath: '/src/other', account: { login: 'octocat' } },
    ]);
    const identity = await identify();
    expect(identity.source).toBe('none');
    expect(identity.login).toBeNull();
    expect(fetchAccount).not.toHaveBeenCalled();
  });

  it('names Git Credential Manager as the source when it holds the login', async () => {
    credentialHelpersFor.mockResolvedValue([{ ...OSXKEYCHAIN, helper: 'manager', cli: 'gcm' }]);
    expect((await identify()).source).toBe('gcm');
  });

  it('asks the service once per host and user', async () => {
    await identify();
    await identify('/src/q');
    expect(fetchAccount).toHaveBeenCalledTimes(1);
    clearIdentityCache();
    await identify();
    expect(fetchAccount).toHaveBeenCalledTimes(2);
  });

  it('leaves the login empty and warns when the service rejects the credential', async () => {
    fetchAccount.mockRejectedValue(new HttpError('https://api.github.com/user returned 401', 401));
    const identity = await identify();
    expect(identity).toMatchObject({ source: 'system', login: null, profile: 'rejected' });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ op: 'account-profile', status: 'warning' });
    expect(JSON.stringify(entries)).not.toContain(TOKEN);
    fetchAccount.mockResolvedValue(profile);
    expect((await identify()).login).toBe('octocat');
  });

  it('tells a service it could not reach apart from a rejection', async () => {
    fetchAccount.mockRejectedValue(new Error('getaddrinfo ENOTFOUND api.github.com'));
    expect(await identify()).toMatchObject({ login: null, profile: 'unavailable' });
  });

  it('reports nobody when git has nothing stored', async () => {
    storedCredential.mockResolvedValue(null);
    expect(await identify()).toMatchObject({ source: 'none', host: 'github.com', login: null });
  });
});

describe('resolveIdentity over ssh', () => {
  beforeEach(() => {
    remoteUrl = 'git@github.com:a/b.git';
    vi.stubEnv('GIT_SSH_COMMAND', '');
    vi.stubEnv('GIT_SSH', '');
  });

  it('takes the name from the ssh greeting', async () => {
    sshStderr =
      "Hi octocat! You've successfully authenticated, but GitHub does not provide shell access.";
    const identity = await identify();
    expect(identity).toMatchObject({ source: 'ssh', login: 'octocat', ssh: { ok: true } });
    expect(storedCredential).not.toHaveBeenCalled();
    expect(spawned[spawned.length - 1]?.args.slice(-1)[0]).toBe('git@github.com');
  });

  it.runIf(process.platform !== 'win32')("uses the repository's core.sshCommand", async () => {
    sshCommandConfig = 'ssh -i /keys/work';
    sshStderr = 'Welcome to GitLab, @jane!';
    expect((await identify()).login).toBe('jane');
    const run = spawned[spawned.length - 1];
    expect(run.file).toBe('/bin/sh');
    expect(run.args[1]).toBe('ssh -i /keys/work "$@"');
  });

  it('logs a rejected key as a warning of its own', async () => {
    sshStderr = 'git@github.com: Permission denied (publickey).';
    const identity = await identify();
    expect(identity.ssh).toEqual({ ok: false, login: null, reason: 'key-rejected' });
    expect(entries.map(e => [e.op, e.status])).toEqual([['ssh-check', 'warning']]);
  });
});
