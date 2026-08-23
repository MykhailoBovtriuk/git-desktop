import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { GitService } from '../../electron/git-service';
import { buildSshCommand, expandHome, parseSshKeyPath } from '../../electron/git/profile';

let tmpDir: string;
let keyPath: string;
let git: GitService;

const config = (key: string): string | null => {
  try {
    return execSync(`git config --local --get ${key}`, { cwd: tmpDir }).toString().trim();
  } catch {
    return null;
  }
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-profile-'));
  execSync('git init', { cwd: tmpDir });
  keyPath = path.join(tmpDir, 'id_test');
  fs.writeFileSync(keyPath, 'not-a-real-key');
  git = new GitService();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('ssh command helpers', () => {
  it('pins the identity so ssh-agent cannot substitute another key', () => {
    expect(buildSshCommand('/home/jane/.ssh/id_ed25519')).toBe(
      'ssh -i "/home/jane/.ssh/id_ed25519" -o IdentitiesOnly=yes',
    );
  });

  it('round-trips the key path back out of a stored core.sshCommand', () => {
    const withSpaces = '/Users/jane/my keys/id_ed25519';
    expect(parseSshKeyPath(buildSshCommand(withSpaces))).toBe(withSpaces);
  });

  it('reads an unquoted -i written by another tool', () => {
    expect(parseSshKeyPath('ssh -i /home/jane/.ssh/id_rsa')).toBe('/home/jane/.ssh/id_rsa');
  });

  it('reports no key when core.sshCommand is unset', () => {
    expect(parseSshKeyPath(null)).toBeNull();
  });

  it('expands a leading ~ only', () => {
    expect(expandHome('~/.ssh/id')).toBe(path.join(os.homedir(), '.ssh/id'));
    expect(expandHome('/etc/~/x')).toBe('/etc/~/x');
  });
});

describe('applyProfile', () => {
  it('writes name and email into the repository-local config', async () => {
    await git.openRepo(tmpDir);
    await git.applyProfile({ id: '1', label: 'Work', name: 'Jane', email: 'jane@work.com' });

    expect(config('user.name')).toBe('Jane');
    expect(config('user.email')).toBe('jane@work.com');
    expect(config('core.sshCommand')).toBeNull();
  });

  it('sets core.sshCommand from a validated key path', async () => {
    await git.openRepo(tmpDir);
    const identity = await git.applyProfile({
      id: '1',
      label: 'Work',
      name: 'Jane',
      email: 'jane@work.com',
      sshKeyPath: keyPath,
    });

    expect(config('core.sshCommand')).toBe(buildSshCommand(keyPath));
    expect(identity.sshKeyPath).toBe(keyPath);
  });

  it('rejects a key path that does not exist', async () => {
    await git.openRepo(tmpDir);
    await expect(
      git.applyProfile({
        id: '1',
        label: 'Work',
        name: 'Jane',
        email: 'jane@work.com',
        sshKeyPath: path.join(tmpDir, 'missing'),
      }),
    ).rejects.toThrow(/not found/);
  });

  it('rejects a key path carrying shell metacharacters', async () => {
    await git.openRepo(tmpDir);
    await expect(
      git.applyProfile({
        id: '1',
        label: 'Work',
        name: 'Jane',
        email: 'jane@work.com',
        sshKeyPath: `${keyPath}"; rm -rf /; echo "`,
      }),
    ).rejects.toThrow(/unsupported characters/);
  });

  it('rejects a relative key path', async () => {
    await git.openRepo(tmpDir);
    await expect(
      git.applyProfile({
        id: '1',
        label: 'Work',
        name: 'Jane',
        email: 'jane@work.com',
        sshKeyPath: 'id_test',
      }),
    ).rejects.toThrow(/absolute/);
  });

  it('enables ssh signing and prefers the sibling .pub', async () => {
    fs.writeFileSync(`${keyPath}.pub`, 'ssh-ed25519 AAAA test');
    await git.openRepo(tmpDir);
    await git.applyProfile({
      id: '1',
      label: 'Work',
      name: 'Jane',
      email: 'jane@work.com',
      sshKeyPath: keyPath,
      signCommits: true,
    });

    expect(config('user.signingkey')).toBe(`${keyPath}.pub`);
    expect(config('gpg.format')).toBe('ssh');
    expect(config('commit.gpgsign')).toBe('true');
  });

  it('falls back to the private key when there is no .pub', async () => {
    await git.openRepo(tmpDir);
    await git.applyProfile({
      id: '1',
      label: 'Work',
      name: 'Jane',
      email: 'jane@work.com',
      sshKeyPath: keyPath,
      signCommits: true,
    });

    expect(config('user.signingkey')).toBe(keyPath);
  });

  it('refuses to sign without a key', async () => {
    await git.openRepo(tmpDir);
    await expect(
      git.applyProfile({
        id: '1',
        label: 'Work',
        name: 'Jane',
        email: 'jane@work.com',
        signCommits: true,
      }),
    ).rejects.toThrow(/requires an SSH key/);
  });

  it('clears signing keys when switching to an unsigned profile', async () => {
    await git.openRepo(tmpDir);
    const signed = {
      id: '1',
      label: 'Work',
      name: 'Jane',
      email: 'jane@work.com',
      sshKeyPath: keyPath,
      signCommits: true,
    };
    await git.applyProfile(signed);
    await git.applyProfile({ ...signed, id: '2', label: 'Personal', signCommits: false });

    expect(config('user.signingkey')).toBeNull();
    expect(config('gpg.format')).toBeNull();
    expect(config('commit.gpgsign')).toBeNull();
    expect(config('core.sshCommand')).toBe(buildSshCommand(keyPath));
  });

  it('drops core.sshCommand when the new profile has no key', async () => {
    await git.openRepo(tmpDir);
    await git.applyProfile({
      id: '1',
      label: 'Work',
      name: 'Jane',
      email: 'jane@work.com',
      sshKeyPath: keyPath,
    });
    await git.applyProfile({ id: '2', label: 'Personal', name: 'Jane', email: 'jane@home.com' });

    expect(config('core.sshCommand')).toBeNull();
    expect(config('user.email')).toBe('jane@home.com');
  });
});

describe('getIdentity / clearProfile', () => {
  it('reports an unconfigured repository as empty', async () => {
    await git.openRepo(tmpDir);
    expect(await git.getIdentity()).toEqual({
      name: null,
      email: null,
      sshKeyPath: null,
      signingKey: null,
      signCommits: false,
    });
  });

  it('reads back what applyProfile wrote', async () => {
    await git.openRepo(tmpDir);
    await git.applyProfile({
      id: '1',
      label: 'Work',
      name: 'Jane',
      email: 'jane@work.com',
      sshKeyPath: keyPath,
      signCommits: true,
    });

    const identity = await git.getIdentity();
    expect(identity.name).toBe('Jane');
    expect(identity.email).toBe('jane@work.com');
    expect(identity.sshKeyPath).toBe(keyPath);
    expect(identity.signCommits).toBe(true);
  });

  it('returns the repository to the global config', async () => {
    await git.openRepo(tmpDir);
    await git.applyProfile({
      id: '1',
      label: 'Work',
      name: 'Jane',
      email: 'jane@work.com',
      sshKeyPath: keyPath,
      signCommits: true,
    });

    const identity = await git.clearProfile();

    expect(identity.name).toBeNull();
    expect(config('user.email')).toBeNull();
    expect(config('core.sshCommand')).toBeNull();
    expect(config('commit.gpgsign')).toBeNull();
  });

  it('is a no-op on a repository that never had a profile', async () => {
    await git.openRepo(tmpDir);
    await expect(git.clearProfile()).resolves.toBeTruthy();
  });
});
