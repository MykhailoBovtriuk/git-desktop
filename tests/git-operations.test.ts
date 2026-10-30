import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { GitContext } from '../electron/git/context';
import * as branchesGit from '../electron/git/branches';
import * as filesGit from '../electron/git/files';
import * as historyGit from '../electron/git/history';
import * as mergeGit from '../electron/git/merge';
import * as rebaseGit from '../electron/git/rebase';
import * as remoteGit from '../electron/git/remote';
import * as stashGit from '../electron/git/stash';
import * as statusGit from '../electron/git/status';
import { credentialSafeEnv } from '../electron/git/context';
import { buildHunkPatch } from '../src/lib/build-patch';

let tmpDir: string;
let git: GitContext;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-test-'));
  execSync('git init', { cwd: tmpDir });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir });
  execSync('git config user.name "Test"', { cwd: tmpDir });
  fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'hello');
  execSync('git add . && git commit -m "initial"', { cwd: tmpDir });
  git = new GitContext();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('git operations', () => {
  it('openRepo sets working directory', async () => {
    await git.openRepo(tmpDir);
    const log = await historyGit.getLog(git, 10, 0);
    expect(log.length).toBe(1);
    expect(log[0].message).toBe('initial');
  });

  it('getLog returns commits with hashes and parents', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'updated');
    execSync('git add . && git commit -m "second"', { cwd: tmpDir });

    const log = await historyGit.getLog(git, 10, 0);
    expect(log.length).toBe(2);
    expect(log[0].message).toBe('second');
    expect(log[0].parents.length).toBe(1);
    expect(log[0].abbreviatedHash).toHaveLength(7);
  });

  it('getLog keeps refs/stash and its helper commits out of history', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'stash me');
    execSync('git stash push -m "drawer"', { cwd: tmpDir });

    const log = await historyGit.getLog(git, 10, 0);
    expect(log.some(c => c.refs.some(r => r.includes('refs/stash')))).toBe(false);
    expect(log.some(c => /^index on /.test(c.message))).toBe(false);
    expect(log.some(c => c.message.includes('drawer'))).toBe(false);
  });

  it('getHeadCommit returns HEAD even when another branch has newer commits', async () => {
    await git.openRepo(tmpDir);
    execSync('git checkout -b feature', { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, 'feat.txt'), 'x');
    execSync('git add . && git commit -m "newer elsewhere"', { cwd: tmpDir });
    execSync('git checkout -', { cwd: tmpDir });

    const expected = execSync('git rev-parse --short HEAD', { cwd: tmpDir }).toString().trim();
    expect(await historyGit.getHeadCommit(git)).toBe(expected);
    const log = await historyGit.getLog(git, 10, 0);
    expect(log[0].message).toBe('newer elsewhere');
    expect(log[0].abbreviatedHash).not.toBe(expected);
  });

  it('getBranches returns current branch', async () => {
    await git.openRepo(tmpDir);
    const branches = await branchesGit.getBranches(git);
    const current = branches.find(b => b.current);
    expect(current).toBeDefined();
    expect(current!.name).toMatch(/main|master/);
  });

  it('getStatus shows staged and unstaged files', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'new.txt'), 'new file');
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'changed');

    const status = await statusGit.getStatus(git);
    expect(status.unstaged.length).toBeGreaterThanOrEqual(2);
  });

  it('stageFiles and unstageFiles work', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'new.txt'), 'content');

    await statusGit.stageFiles(git, ['new.txt']);
    let status = await statusGit.getStatus(git);
    expect(status.staged.some(f => f.path === 'new.txt')).toBe(true);

    await statusGit.unstageFiles(git, ['new.txt']);
    status = await statusGit.getStatus(git);
    expect(status.staged.some(f => f.path === 'new.txt')).toBe(false);
  });

  it('commit creates a new commit', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'new.txt'), 'content');
    await statusGit.stageFiles(git, ['new.txt']);

    const hash = await statusGit.commit(git, 'add new file');
    expect(hash).toBeTruthy();

    const log = await historyGit.getLog(git, 10, 0);
    expect(log[0].message).toBe('add new file');
  });

  it('discardChanges reverts file to last commit', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'changed');

    await statusGit.discardChanges(git, ['file.txt']);
    const content = fs.readFileSync(path.join(tmpDir, 'file.txt'), 'utf-8');
    expect(content).toBe('hello');
  });

  it('createBranch creates a branch at HEAD and switches to it', async () => {
    await git.openRepo(tmpDir);
    await branchesGit.createBranch(git, 'feature/login');

    const branches = await branchesGit.getBranches(git);
    expect(branches.find(b => b.current)!.name).toBe('feature/login');
    expect(await historyGit.getHeadCommit(git)).toBe(
      execSync('git rev-parse --short HEAD', { cwd: tmpDir }).toString().trim(),
    );
  });

  it('createBranch carries uncommitted work over, staged and unstaged alike', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'edited');
    fs.writeFileSync(path.join(tmpDir, 'fresh.txt'), 'brand new');
    execSync('git add file.txt', { cwd: tmpDir });

    await branchesGit.createBranch(git, 'feature/wip');

    const status = await statusGit.getStatus(git);
    expect(status.staged.map(f => f.path)).toEqual(['file.txt']);
    expect(status.unstaged.map(f => f.path)).toEqual(['fresh.txt']);
    expect(fs.readFileSync(path.join(tmpDir, 'fresh.txt'), 'utf8')).toBe('brand new');
  });

  it('createBranch refuses a name that is already taken', async () => {
    await git.openRepo(tmpDir);
    await branchesGit.createBranch(git, 'feature/login');
    execSync('git checkout -q -', { cwd: tmpDir });

    await expect(branchesGit.createBranch(git, 'feature/login')).rejects.toThrow();
  });

  it('stashSave takes untracked files too when asked', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'edited');
    fs.writeFileSync(path.join(tmpDir, 'fresh.txt'), 'brand new');

    await stashGit.stashSave(git, 'WIP on main', false, true);

    const status = await statusGit.getStatus(git);
    expect(status.staged).toEqual([]);
    expect(status.unstaged).toEqual([]);
    expect(fs.existsSync(path.join(tmpDir, 'fresh.txt'))).toBe(false);
  });

  it('stashSave leaves untracked files alone by default', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'edited');
    fs.writeFileSync(path.join(tmpDir, 'fresh.txt'), 'brand new');

    await stashGit.stashSave(git, 'WIP on main');

    expect(fs.existsSync(path.join(tmpDir, 'fresh.txt'))).toBe(true);
  });

  it('stashSave refuses to combine staged-only with untracked', async () => {
    await git.openRepo(tmpDir);
    await expect(stashGit.stashSave(git, 'nope', true, true)).rejects.toThrow(
      /mutually exclusive/i,
    );
  });

  it('checkout switches branch', async () => {
    await git.openRepo(tmpDir);
    execSync('git checkout -b develop', { cwd: tmpDir });
    execSync('git checkout master || git checkout main', { cwd: tmpDir });

    await branchesGit.checkout(git, 'develop');
    const branches = await branchesGit.getBranches(git);
    expect(branches.find(b => b.current)!.name).toBe('develop');
  });

  it('getWorkingDiff returns diff text', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'hello\nworld');

    const diff = await statusGit.getWorkingDiff(git, 'file.txt');
    expect(diff).toContain('+world');
  });

  it('getCommitDiff works on the initial commit (no parent)', async () => {
    await git.openRepo(tmpDir);
    const log = await historyGit.getLog(git, 10, 0);
    const initialHash = log[log.length - 1].hash;
    const files = await historyGit.getCommitDiff(git, initialHash);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some(f => f.path === 'file.txt')).toBe(true);
  });

  it('getCommitDiff reports added, modified and deleted files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'added.txt'), 'new\n');
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'changed\n');
    execSync('git add . && git commit -m "add and modify"', { cwd: tmpDir });
    execSync('git rm -q added.txt && git commit -m "delete"', { cwd: tmpDir });
    await git.openRepo(tmpDir);
    const [deleted, changed] = await historyGit.getLog(git, 2, 0);

    expect(await historyGit.getCommitDiff(git, changed.hash)).toEqual(
      expect.arrayContaining([
        { path: 'added.txt', status: 'A' },
        { path: 'file.txt', status: 'M' },
      ]),
    );
    expect(await historyGit.getCommitDiff(git, deleted.hash)).toEqual([
      { path: 'added.txt', status: 'D' },
    ]);
  });

  it('checkout of a missing branch never restores a file of that name', async () => {
    fs.writeFileSync(path.join(tmpDir, 'notes'), 'tracked\n');
    execSync('git add . && git commit -m "notes file"', { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, 'notes'), 'unsaved work\n');
    await git.openRepo(tmpDir);

    await expect(branchesGit.checkout(git, 'notes')).rejects.toThrow();
    expect(fs.readFileSync(path.join(tmpDir, 'notes'), 'utf8')).toBe('unsaved work\n');
  });

  it('lists a stash whose message contains the old field separator', async () => {
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'dirty\n');
    execSync('git stash push -m "a|||b"', { cwd: tmpDir });
    await git.openRepo(tmpDir);
    const [entry] = await stashGit.getStashList(git);
    expect(entry.message).toContain('a|||b');
    expect(entry.date).not.toBe('');
  });

  it('getFileDiff works on the initial commit (no parent)', async () => {
    await git.openRepo(tmpDir);
    const log = await historyGit.getLog(git, 10, 0);
    const initialHash = log[log.length - 1].hash;
    const diff = await historyGit.getFileDiff(git, initialHash, 'file.txt');
    expect(diff).toContain('+hello');
  });

  it('getWorkingDiff synthesizes a diff for an untracked file', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'newfile.txt'), 'line1\nline2\n');

    const diff = await statusGit.getWorkingDiff(git, 'newfile.txt');
    expect(diff).toContain('diff --git a/newfile.txt b/newfile.txt');
    expect(diff).toContain('new file mode 100644');
    expect(diff).toContain('--- /dev/null');
    expect(diff).toContain('+++ b/newfile.txt');
    expect(diff).toContain('+line1');
    expect(diff).toContain('+line2');
  });

  it('getWorkingDiff returns empty diff for a clean tracked file', async () => {
    await git.openRepo(tmpDir);
    const diff = await statusGit.getWorkingDiff(git, 'file.txt');
    expect(diff).toBe('');
  });

  it('getBranches reports no tracking for a branch without an upstream', async () => {
    await git.openRepo(tmpDir);
    const current = (await branchesGit.getBranches(git)).find(b => b.current)!;
    expect(current.tracking).toBeUndefined();
  });

  it('getBranches reports upstream tracking for a published branch', async () => {
    const remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-remote-'));
    execSync('git init --bare', { cwd: remoteDir });
    execSync(`git remote add origin "${remoteDir}"`, { cwd: tmpDir });
    execSync('git push -u origin HEAD', { cwd: tmpDir });
    await git.openRepo(tmpDir);
    const current = (await branchesGit.getBranches(git)).find(b => b.current)!;
    expect(current.tracking).toMatch(/^origin\//);
    fs.rmSync(remoteDir, { recursive: true, force: true });
  });

  it('getStatus reports no upstream for an unpublished branch', async () => {
    await git.openRepo(tmpDir);
    expect((await statusGit.getStatus(git)).upstream).toBeNull();
  });

  it('getStatus reports the upstream of a published branch', async () => {
    const remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-remote-'));
    execSync('git init --bare', { cwd: remoteDir });
    execSync(`git remote add origin "${remoteDir}"`, { cwd: tmpDir });
    execSync('git push -u origin HEAD', { cwd: tmpDir });
    await git.openRepo(tmpDir);
    expect((await statusGit.getStatus(git)).upstream).toMatch(/^origin\//);
    fs.rmSync(remoteDir, { recursive: true, force: true });
  });

  it('pushSetUpstream publishes a branch and sets its upstream', async () => {
    const remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-remote-'));
    execSync('git init --bare', { cwd: remoteDir });
    execSync(`git remote add origin "${remoteDir}"`, { cwd: tmpDir });
    await git.openRepo(tmpDir);
    const before = (await branchesGit.getBranches(git)).find(b => b.current)!;
    expect(before.tracking).toBeUndefined();

    await remoteGit.pushSetUpstream(git, 'origin', before.name);

    const after = (await branchesGit.getBranches(git)).find(b => b.current)!;
    expect(after.tracking).toMatch(/^origin\//);
    fs.rmSync(remoteDir, { recursive: true, force: true });
  });
});

describe('switchRemoteProtocol', () => {
  const urls = () => ({
    fetch: execSync('git remote get-url origin', { cwd: tmpDir }).toString().trim(),
    push: execSync('git remote get-url --push origin', { cwd: tmpDir }).toString().trim(),
  });

  it('points an ssh origin at the same repository over https', async () => {
    execSync('git remote add origin git@github.com:owner/repo.git', { cwd: tmpDir });
    await git.openRepo(tmpDir);

    expect(await remoteGit.switchRemoteProtocol(git, 'https')).toEqual({
      url: 'https://github.com/owner/repo.git',
      host: 'github.com',
      protocol: 'https',
    });
    expect(urls()).toEqual({
      fetch: 'https://github.com/owner/repo.git',
      push: 'https://github.com/owner/repo.git',
    });
  });

  it('points an https origin at the same repository over ssh', async () => {
    execSync('git remote add origin https://github.com/owner/repo.git', { cwd: tmpDir });
    await git.openRepo(tmpDir);

    expect(await remoteGit.switchRemoteProtocol(git, 'ssh')).toEqual({
      url: 'git@github.com:owner/repo.git',
      host: 'github.com',
      protocol: 'ssh',
    });
    expect(urls().fetch).toBe('git@github.com:owner/repo.git');
  });

  it('restores the original ssh address, alias and all, on the way back', async () => {
    execSync('git remote add origin git@github.com:owner/repo.git', { cwd: tmpDir });
    execSync('git remote set-url --push origin git@github.com:owner/fork.git', { cwd: tmpDir });
    await git.openRepo(tmpDir);

    await remoteGit.switchRemoteProtocol(git, 'https');
    expect(urls()).toEqual({
      fetch: 'https://github.com/owner/repo.git',
      push: 'https://github.com/owner/fork.git',
    });

    await remoteGit.switchRemoteProtocol(git, 'ssh');
    expect(urls()).toEqual({
      fetch: 'git@github.com:owner/repo.git',
      push: 'git@github.com:owner/fork.git',
    });
  });

  it('ignores a remembered ssh address once the remote points elsewhere', async () => {
    execSync('git remote add origin git@github.com:owner/repo.git', { cwd: tmpDir });
    await git.openRepo(tmpDir);
    await remoteGit.switchRemoteProtocol(git, 'https');
    execSync('git remote set-url origin https://github.com/other/project.git', { cwd: tmpDir });

    await remoteGit.switchRemoteProtocol(git, 'ssh');
    expect(urls().fetch).toBe('git@github.com:other/project.git');
  });

  it('refuses a switch to the protocol the remote already uses', async () => {
    execSync('git remote add origin https://github.com/owner/repo.git', { cwd: tmpDir });
    await git.openRepo(tmpDir);

    await expect(remoteGit.switchRemoteProtocol(git, 'https')).rejects.toThrow();
    expect(urls().fetch).toBe('https://github.com/owner/repo.git');
  });
});

describe('stageFiles/markResolved with dash-prefixed paths', () => {
  it('stageFiles stages only the named file, not everything', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, '-A'), 'dash file');
    fs.writeFileSync(path.join(tmpDir, 'other.txt'), 'other');

    await statusGit.stageFiles(git, ['-A']);

    const status = await statusGit.getStatus(git);
    expect(status.staged.map(f => f.path)).toEqual(['-A']);
    expect(status.unstaged.map(f => f.path)).toEqual(['other.txt']);
  });

  it('markResolved stages only the named file', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, '-A'), 'dash file');
    fs.writeFileSync(path.join(tmpDir, 'other.txt'), 'other');

    await mergeGit.markResolved(git, '-A');

    const status = await statusGit.getStatus(git);
    expect(status.staged.map(f => f.path)).toEqual(['-A']);
    expect(status.unstaged.map(f => f.path)).toEqual(['other.txt']);
  });
});

describe('rebase lifecycle', () => {
  function makeRebaseConflict(): { mainBranch: string } {
    const mainBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: tmpDir })
      .toString()
      .trim();
    execSync('git checkout -b feature', { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'feature change');
    execSync('git commit -am "feature edit"', { cwd: tmpDir });
    execSync(`git checkout ${mainBranch}`, { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'main change');
    execSync('git commit -am "main edit"', { cwd: tmpDir });
    execSync('git checkout feature', { cwd: tmpDir });
    return { mainBranch };
  }

  it('isRebasing is false in a normal repo state', async () => {
    await git.openRepo(tmpDir);
    expect(await rebaseGit.isRebasing(git)).toBe(false);
  });

  it('conflicted rebase rejects, isRebasing becomes true, abortRebase restores a clean tree', async () => {
    await git.openRepo(tmpDir);
    const { mainBranch } = makeRebaseConflict();

    await expect(rebaseGit.rebase(git, mainBranch)).rejects.toThrow();
    expect(await rebaseGit.isRebasing(git)).toBe(true);

    await rebaseGit.abortRebase(git);
    expect(await rebaseGit.isRebasing(git)).toBe(false);

    const status = await statusGit.getStatus(git);
    expect(status.staged).toEqual([]);
    expect(status.unstaged).toEqual([]);
    expect(fs.readFileSync(path.join(tmpDir, 'file.txt'), 'utf-8')).toBe('feature change');
  });

  it('continueRebase rejects while conflicts remain, completes after resolution', async () => {
    await git.openRepo(tmpDir);
    const { mainBranch } = makeRebaseConflict();

    await expect(rebaseGit.rebase(git, mainBranch)).rejects.toThrow();
    await expect(rebaseGit.continueRebase(git)).rejects.toThrow();
    expect(await rebaseGit.isRebasing(git)).toBe(true);

    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'resolved');
    execSync('git add file.txt', { cwd: tmpDir });
    await rebaseGit.continueRebase(git);

    expect(await rebaseGit.isRebasing(git)).toBe(false);
    const log = await historyGit.getLog(git, 10, 0);
    expect(log.map(c => c.message)).toContain('feature edit');
    expect(log.map(c => c.message)).toContain('main edit');
  });
});

describe('credential prompt safety (Fix 2)', () => {
  it('credentialSafeEnv disables terminal prompts and merges over process.env', () => {
    const env = credentialSafeEnv();
    expect(env.GIT_TERMINAL_PROMPT).toBe('0');
    expect(env.GIT_ASKPASS).toBe('echo');
    expect(env.PATH).toBe(process.env.PATH);
  });
});

describe('empty repository (unborn HEAD)', () => {
  let emptyDir: string;

  beforeEach(() => {
    emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-empty-'));
    execSync('git init', { cwd: emptyDir });
    execSync('git config user.email "test@test.com"', { cwd: emptyDir });
    execSync('git config user.name "Test"', { cwd: emptyDir });
  });

  afterEach(() => {
    fs.rmSync(emptyDir, { recursive: true, force: true });
  });

  it('getLog returns [] instead of throwing', async () => {
    await git.openRepo(emptyDir);
    await expect(historyGit.getLog(git, 50, 0)).resolves.toEqual([]);
  });

  it('unstageFiles removes a staged file from the index without HEAD', async () => {
    await git.openRepo(emptyDir);
    fs.writeFileSync(path.join(emptyDir, 'new.txt'), 'content');

    await statusGit.stageFiles(git, ['new.txt']);
    let status = await statusGit.getStatus(git);
    expect(status.staged.some(f => f.path === 'new.txt')).toBe(true);

    await statusGit.unstageFiles(git, ['new.txt']);
    status = await statusGit.getStatus(git);
    expect(status.staged.some(f => f.path === 'new.txt')).toBe(false);
    expect(status.unstaged.some(f => f.path === 'new.txt' && !f.staged)).toBe(true);
    expect(fs.readFileSync(path.join(emptyDir, 'new.txt'), 'utf-8')).toBe('content');
  });
});

describe('readFile/writeFile path guards', () => {
  beforeEach(async () => {
    await git.openRepo(tmpDir);
  });

  it('allows normal reads and writes inside the repo', async () => {
    await filesGit.writeFile(git, 'sub/dir-file.txt', 'nested').catch(() => {});
    await filesGit.writeFile(git, 'plain.txt', 'ok');
    expect(await filesGit.readFile(git, 'plain.txt')).toBe('ok');
    await filesGit.writeFile(git, '.gitignore', 'node_modules\n');
    expect(await filesGit.readFile(git, '.gitignore')).toBe('node_modules\n');
  });

  it('rejects writes into .git', async () => {
    await expect(filesGit.writeFile(git, '.git/hooks/pre-commit', '#!/bin/sh\n')).rejects.toThrow();
    expect(fs.existsSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'))).toBe(false);
    await expect(filesGit.writeFile(git, '.git/config', '[core]')).rejects.toThrow();
  });

  it('rejects reads from .git', async () => {
    await expect(filesGit.readFile(git, '.git/config')).rejects.toThrow();
  });

  it('rejects .git regardless of case', async () => {
    await expect(filesGit.writeFile(git, '.GIT/config', 'x')).rejects.toThrow();
  });

  // Creating symlinks on Windows requires elevation/developer mode, which CI
  // runners don't have — the guard itself is platform-independent.
  const itUnix = it.skipIf(process.platform === 'win32');

  itUnix('rejects reading through a symlink that points outside the repo', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-outside-'));
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret');
    fs.symlinkSync(outside, path.join(tmpDir, 'link'));

    await expect(filesGit.readFile(git, 'link/secret.txt')).rejects.toThrow(/outside repository/);
    fs.rmSync(outside, { recursive: true, force: true });
  });

  itUnix('rejects writing through a symlink that points outside the repo', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-outside-'));
    fs.symlinkSync(outside, path.join(tmpDir, 'link'));

    await expect(filesGit.writeFile(git, 'link/evil.txt', 'x')).rejects.toThrow(
      /outside repository/,
    );
    expect(fs.existsSync(path.join(outside, 'evil.txt'))).toBe(false);
    fs.rmSync(outside, { recursive: true, force: true });
  });

  itUnix('rejects a file symlink that points outside the repo', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-outside-'));
    const target = path.join(outside, 'target.txt');
    fs.writeFileSync(target, 'outside content');
    fs.symlinkSync(target, path.join(tmpDir, 'file-link.txt'));

    await expect(filesGit.readFile(git, 'file-link.txt')).rejects.toThrow(/outside repository/);
    await expect(filesGit.writeFile(git, 'file-link.txt', 'overwrite')).rejects.toThrow(
      /outside repository/,
    );
    expect(fs.readFileSync(target, 'utf-8')).toBe('outside content');
    fs.rmSync(outside, { recursive: true, force: true });
  });
});

describe('applyPatch (hunk-level staging)', () => {
  const TWENTY = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join('\n') + '\n';

  const seedMultiHunk = () => {
    fs.writeFileSync(path.join(tmpDir, 'multi.txt'), TWENTY);
    execSync('git add multi.txt && git commit -m "multi"', { cwd: tmpDir });
    const lines = TWENTY.split('\n');
    lines[1] = 'LINE2';
    lines[17] = 'LINE18';
    fs.writeFileSync(path.join(tmpDir, 'multi.txt'), lines.join('\n'));
  };

  it('stages only the selected hunk, leaving the other unstaged', async () => {
    seedMultiHunk();
    await git.openRepo(tmpDir);

    const raw = await statusGit.getWorkingDiff(git, 'multi.txt');
    expect((raw.match(/^@@ /gm) || []).length).toBe(2);

    await statusGit.applyPatch(git, buildHunkPatch(raw, 0), { cached: true });

    const staged = await statusGit.getStagedDiff(git, 'multi.txt');
    expect(staged).toContain('LINE2');
    expect(staged).not.toContain('LINE18');

    const working = await statusGit.getWorkingDiff(git, 'multi.txt');
    expect(working).toContain('LINE18');
    expect(working).not.toContain('LINE2');
  });

  it('unstages a single hunk with reverse', async () => {
    seedMultiHunk();
    await git.openRepo(tmpDir);

    await statusGit.stageFiles(git, ['multi.txt']);
    let staged = await statusGit.getStagedDiff(git, 'multi.txt');
    expect((staged.match(/^@@ /gm) || []).length).toBe(2);

    await statusGit.applyPatch(git, buildHunkPatch(staged, 0), { cached: true, reverse: true });

    staged = await statusGit.getStagedDiff(git, 'multi.txt');
    expect(staged).not.toContain('LINE2');
    expect(staged).toContain('LINE18');
  });

  it('rejects a patch that does not apply and cleans up its temp file', async () => {
    seedMultiHunk();
    await git.openRepo(tmpDir);
    const bogus = [
      'diff --git a/multi.txt b/multi.txt',
      'index 1111111..2222222 100644',
      '--- a/multi.txt',
      '+++ b/multi.txt',
      '@@ -1,1 +1,1 @@',
      '-nonexistent context',
      '+something',
      '',
    ].join('\n');
    await expect(statusGit.applyPatch(git, bogus, { cached: true })).rejects.toThrow();
  });
});
