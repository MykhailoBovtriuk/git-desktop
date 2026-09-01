import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ensureGlobalIdentity, hasIdentity } from '../../electron/auth/identity-bootstrap';
import { stripLegacyProfileKeys } from '../../electron/auth/legacy-cleanup';
import type { ProviderAccount } from '../../src/types';

// git reads --global from $HOME, so a scratch home is what keeps these tests
// from rewriting the identity of whoever runs them.
let home: string;
let realHome: string | undefined;

const ACCOUNT: ProviderAccount = {
  id: 'github.com|octocat',
  providerId: 'github',
  host: 'github.com',
  displayName: 'GitHub',
  login: 'octocat',
  name: 'The Octocat',
  email: 'octo@example.com',
  avatarDataUrl: null,
};

const readGlobal = (key: string) => {
  try {
    return execFileSync('git', ['config', '--global', '--get', key], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-home-'));
  realHome = process.env.HOME;
  process.env.HOME = home;
});

afterEach(() => {
  if (realHome === undefined) delete process.env.HOME;
  else process.env.HOME = realHome;
  fs.rmSync(home, { recursive: true, force: true });
});

describe('ensureGlobalIdentity', () => {
  it('fills in a name and email git does not have', async () => {
    await ensureGlobalIdentity(ACCOUNT);
    expect(readGlobal('user.name')).toBe('The Octocat');
    expect(readGlobal('user.email')).toBe('octo@example.com');
  });

  // Overwriting an address the user chose would misattribute their commits,
  // invisibly, until someone noticed the wrong author on a branch.
  it('leaves an identity the user already set untouched', async () => {
    execFileSync('git', ['config', '--global', 'user.name', 'Existing Person']);
    execFileSync('git', ['config', '--global', 'user.email', 'existing@work.example']);

    await ensureGlobalIdentity(ACCOUNT);
    expect(readGlobal('user.name')).toBe('Existing Person');
    expect(readGlobal('user.email')).toBe('existing@work.example');
  });

  it('fills only the half that is missing', async () => {
    execFileSync('git', ['config', '--global', 'user.email', 'existing@work.example']);
    await ensureGlobalIdentity(ACCOUNT);
    expect(readGlobal('user.name')).toBe('The Octocat');
    expect(readGlobal('user.email')).toBe('existing@work.example');
  });

  // An account with no public email — GitHub hides them by default — must not
  // write an empty address, which git would reject on the next commit.
  it('writes no email when the account has none', async () => {
    await ensureGlobalIdentity({ ...ACCOUNT, email: '' });
    expect(readGlobal('user.email')).toBe('');
    expect(readGlobal('user.name')).toBe('The Octocat');
  });

  it('falls back to the login when the account has no display name', async () => {
    await ensureGlobalIdentity({ ...ACCOUNT, name: null });
    expect(readGlobal('user.name')).toBe('octocat');
  });
});

describe('hasIdentity', () => {
  let repo: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-repo-'));
    execFileSync('git', ['init'], { cwd: repo });
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('is false when neither the repository nor the global config names an author', async () => {
    expect(await hasIdentity(repo)).toBe(false);
  });

  it('is true once the global config has one', async () => {
    execFileSync('git', ['config', '--global', 'user.email', 'me@example.com']);
    expect(await hasIdentity(repo)).toBe(true);
  });

  // A repository-level override counts too — that is the whole reason the
  // question is asked per repository rather than once for the machine.
  it('is true for a repository-level override alone', async () => {
    execFileSync('git', ['config', '--local', 'user.email', 'me@work.example'], { cwd: repo });
    expect(await hasIdentity(repo)).toBe(true);
  });
});

describe('stripLegacyProfileKeys', () => {
  let repo: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-legacy-'));
    execFileSync('git', ['init'], { cwd: repo });
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const local = (key: string) => {
    try {
      return execFileSync('git', ['config', '--local', '--get', key], {
        cwd: repo,
        encoding: 'utf8',
      }).trim();
    } catch {
      return '';
    }
  };

  // core.sshCommand routes git around the token this app now stores, so a
  // leftover from the removed profiles feature breaks authentication silently.
  it('removes the keys an older build wrote', async () => {
    execFileSync('git', ['config', '--local', 'core.sshCommand', 'ssh -i ~/.ssh/old'], {
      cwd: repo,
    });
    execFileSync('git', ['config', '--local', 'gitdesktop.profile', 'abc123'], { cwd: repo });

    await stripLegacyProfileKeys(repo);
    expect(local('core.sshCommand')).toBe('');
    expect(local('gitdesktop.profile')).toBe('');
  });

  // This is the only place the app writes to somebody's repository unasked,
  // so it must touch nothing beyond the two keys it put there itself.
  it('leaves every other setting alone', async () => {
    execFileSync('git', ['config', '--local', 'user.email', 'me@work.example'], { cwd: repo });
    execFileSync('git', ['config', '--local', 'core.autocrlf', 'input'], { cwd: repo });

    await stripLegacyProfileKeys(repo);
    expect(local('user.email')).toBe('me@work.example');
    expect(local('core.autocrlf')).toBe('input');
  });

  it('is a no-op on a repository that never had them', async () => {
    await expect(stripLegacyProfileKeys(repo)).resolves.toBeUndefined();
  });
});
