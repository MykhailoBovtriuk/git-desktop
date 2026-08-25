import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { GitService } from '../../electron/git-service';
import { allowedHelpers, setCredentialHelper } from '../../electron/git/auth';

let tmpDir: string;
let git: GitService;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-auth-'));
  execSync('git init', { cwd: tmpDir });
  git = new GitService();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('getAuthStatus', () => {
  it('reports no remote for a fresh repository', async () => {
    await git.openRepo(tmpDir);
    const status = await git.getAuthStatus();
    expect(status.remoteUrl).toBeNull();
    expect(status.isHttps).toBe(false);
  });

  it('recognises an https remote', async () => {
    execSync('git remote add origin https://example.com/team/repo.git', { cwd: tmpDir });
    await git.openRepo(tmpDir);
    const status = await git.getAuthStatus();
    expect(status.remoteUrl).toBe('https://example.com/team/repo.git');
    expect(status.isHttps).toBe(true);
  });

  it('recognises an ssh remote', async () => {
    execSync('git remote add origin git@example.com:team/repo.git', { cwd: tmpDir });
    await git.openRepo(tmpDir);
    const status = await git.getAuthStatus();
    expect(status.isHttps).toBe(false);
  });

  it('reports a configured signing setup as not ready when the key is missing', async () => {
    execSync('git config --local user.signingkey /nope/missing.pub', { cwd: tmpDir });
    execSync('git config --local gpg.format ssh', { cwd: tmpDir });
    execSync('git config --local commit.gpgsign true', { cwd: tmpDir });
    await git.openRepo(tmpDir);
    expect((await git.getAuthStatus()).signingReady).toBe(false);
  });

  // ssh-add -l and ssh-keygen -lf both print a fingerprint and a comment, and
  // those comments routinely carry the user's email. Only the yes/no answer is
  // allowed to cross IPC.
  it('carries no key material or comments in the response', async () => {
    execSync('git remote add origin git@example.com:team/repo.git', { cwd: tmpDir });
    await git.openRepo(tmpDir);
    const serialised = JSON.stringify(await git.getAuthStatus());

    expect(serialised).not.toContain('SHA256:');
    expect(serialised).not.toContain('ssh-ed25519');
    expect(serialised).not.toContain('ssh-rsa');
    expect(serialised).not.toContain('BEGIN OPENSSH PRIVATE KEY');
  });

  it('exposes only the documented fields', async () => {
    await git.openRepo(tmpDir);
    expect(Object.keys(await git.getAuthStatus()).sort()).toEqual([
      'credentialHelper',
      'isHttps',
      'remoteUrl',
      'signingReady',
      'sshSupportsKeychain',
    ]);
  });
});

describe('setCredentialHelper', () => {
  // The value is a command git executes, so anything outside the platform list
  // must be refused before it reaches the config.
  it('refuses a helper that is not on the allowlist', async () => {
    for (const bad of ['/bin/sh -c evil', 'store', '', 'osxkeychain; rm -rf /']) {
      await expect(setCredentialHelper(bad)).rejects.toThrow(/Unsupported credential helper/);
    }
  });

  it('offers a platform-appropriate list', () => {
    expect(allowedHelpers('darwin')).toEqual(['osxkeychain']);
    expect(allowedHelpers('win32')).toContain('manager');
    expect(allowedHelpers('linux')).toContain('libsecret');
    expect(allowedHelpers('sunos')).toEqual([]);
  });
});
