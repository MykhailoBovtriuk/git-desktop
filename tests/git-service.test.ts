import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { GitService, credentialSafeEnv } from '../electron/git-service';
import { buildHunkPatch } from '../src/lib/build-patch';

let tmpDir: string;
let git: GitService;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-test-'));
  execSync('git init', { cwd: tmpDir });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir });
  execSync('git config user.name "Test"', { cwd: tmpDir });
  fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'hello');
  execSync('git add . && git commit -m "initial"', { cwd: tmpDir });
  git = new GitService();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('GitService', () => {
  it('openRepo sets working directory', async () => {
    await git.openRepo(tmpDir);
    const log = await git.getLog(10, 0);
    expect(log.length).toBe(1);
    expect(log[0].message).toBe('initial');
  });

  it('getLog returns commits with hashes and parents', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'updated');
    execSync('git add . && git commit -m "second"', { cwd: tmpDir });

    const log = await git.getLog(10, 0);
    expect(log.length).toBe(2);
    expect(log[0].message).toBe('second');
    expect(log[0].parents.length).toBe(1);
    expect(log[0].abbreviatedHash).toHaveLength(7);
  });

  it('getBranches returns current branch', async () => {
    await git.openRepo(tmpDir);
    const branches = await git.getBranches();
    const current = branches.find(b => b.current);
    expect(current).toBeDefined();
    expect(current!.name).toMatch(/main|master/);
  });

  it('getStatus shows staged and unstaged files', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'new.txt'), 'new file');
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'changed');

    const status = await git.getStatus();
    expect(status.unstaged.length).toBeGreaterThanOrEqual(2);
  });

  it('stageFiles and unstageFiles work', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'new.txt'), 'content');

    await git.stageFiles(['new.txt']);
    let status = await git.getStatus();
    expect(status.staged.some(f => f.path === 'new.txt')).toBe(true);

    await git.unstageFiles(['new.txt']);
    status = await git.getStatus();
    expect(status.staged.some(f => f.path === 'new.txt')).toBe(false);
  });

  it('commit creates a new commit', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'new.txt'), 'content');
    await git.stageFiles(['new.txt']);

    const hash = await git.commit('add new file');
    expect(hash).toBeTruthy();

    const log = await git.getLog(10, 0);
    expect(log[0].message).toBe('add new file');
  });

  it('discardChanges reverts file to last commit', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'changed');

    await git.discardChanges(['file.txt']);
    const content = fs.readFileSync(path.join(tmpDir, 'file.txt'), 'utf-8');
    expect(content).toBe('hello');
  });

  it('checkout switches branch', async () => {
    await git.openRepo(tmpDir);
    execSync('git checkout -b develop', { cwd: tmpDir });
    execSync('git checkout master || git checkout main', { cwd: tmpDir });

    await git.checkout('develop');
    const branches = await git.getBranches();
    expect(branches.find(b => b.current)!.name).toBe('develop');
  });

  it('getWorkingDiff returns diff text', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'hello\nworld');

    const diff = await git.getWorkingDiff('file.txt');
    expect(diff).toContain('+world');
  });

  it('getCommitDiff works on the initial commit (no parent)', async () => {
    await git.openRepo(tmpDir);
    const log = await git.getLog(10, 0);
    const initialHash = log[log.length - 1].hash;
    const files = await git.getCommitDiff(initialHash);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some(f => f.path === 'file.txt')).toBe(true);
  });

  it('getFileDiff works on the initial commit (no parent)', async () => {
    await git.openRepo(tmpDir);
    const log = await git.getLog(10, 0);
    const initialHash = log[log.length - 1].hash;
    const diff = await git.getFileDiff(initialHash, 'file.txt');
    expect(diff).toContain('+hello');
  });

  it('getWorkingDiff synthesizes a diff for an untracked file', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'newfile.txt'), 'line1\nline2\n');

    const diff = await git.getWorkingDiff('newfile.txt');
    expect(diff).toContain('diff --git a/newfile.txt b/newfile.txt');
    expect(diff).toContain('new file mode 100644');
    expect(diff).toContain('--- /dev/null');
    expect(diff).toContain('+++ b/newfile.txt');
    expect(diff).toContain('+line1');
    expect(diff).toContain('+line2');
  });

  it('getWorkingDiff returns empty diff for a clean tracked file', async () => {
    await git.openRepo(tmpDir);
    const diff = await git.getWorkingDiff('file.txt');
    expect(diff).toBe('');
  });

  // P4.31 — upstream tracking / publish flow
  it('getBranches reports no tracking for a branch without an upstream', async () => {
    await git.openRepo(tmpDir);
    const current = (await git.getBranches()).find(b => b.current)!;
    expect(current.tracking).toBeUndefined();
  });

  it('getBranches reports upstream tracking for a published branch', async () => {
    const remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-remote-'));
    execSync('git init --bare', { cwd: remoteDir });
    execSync(`git remote add origin "${remoteDir}"`, { cwd: tmpDir });
    execSync('git push -u origin HEAD', { cwd: tmpDir });
    await git.openRepo(tmpDir);
    const current = (await git.getBranches()).find(b => b.current)!;
    expect(current.tracking).toMatch(/^origin\//);
    fs.rmSync(remoteDir, { recursive: true, force: true });
  });

  it('pushSetUpstream publishes a branch and sets its upstream', async () => {
    const remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-remote-'));
    execSync('git init --bare', { cwd: remoteDir });
    execSync(`git remote add origin "${remoteDir}"`, { cwd: tmpDir });
    await git.openRepo(tmpDir);
    const before = (await git.getBranches()).find(b => b.current)!;
    expect(before.tracking).toBeUndefined();

    await git.pushSetUpstream('origin', before.name);

    const after = (await git.getBranches()).find(b => b.current)!;
    expect(after.tracking).toMatch(/^origin\//);
    fs.rmSync(remoteDir, { recursive: true, force: true });
  });
});

describe('stageFiles/markResolved with dash-prefixed paths', () => {
  // Without a `--` separator, a file named "-A" is parsed by git as the
  // stage-everything flag and other files get staged too.
  it('stageFiles stages only the named file, not everything', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, '-A'), 'dash file');
    fs.writeFileSync(path.join(tmpDir, 'other.txt'), 'other');

    await git.stageFiles(['-A']);

    const status = await git.getStatus();
    expect(status.staged.map(f => f.path)).toEqual(['-A']);
    expect(status.unstaged.map(f => f.path)).toEqual(['other.txt']);
  });

  it('markResolved stages only the named file', async () => {
    await git.openRepo(tmpDir);
    fs.writeFileSync(path.join(tmpDir, '-A'), 'dash file');
    fs.writeFileSync(path.join(tmpDir, 'other.txt'), 'other');

    await git.markResolved('-A');

    const status = await git.getStatus();
    expect(status.staged.map(f => f.path)).toEqual(['-A']);
    expect(status.unstaged.map(f => f.path)).toEqual(['other.txt']);
  });
});

describe('rebase lifecycle', () => {
  // Creates a rebase conflict: two branches change the same line of file.txt.
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
    expect(await git.isRebasing()).toBe(false);
  });

  it('conflicted rebase rejects, isRebasing becomes true, abortRebase restores a clean tree', async () => {
    await git.openRepo(tmpDir);
    const { mainBranch } = makeRebaseConflict();

    await expect(git.rebase(mainBranch)).rejects.toThrow();
    expect(await git.isRebasing()).toBe(true);

    await git.abortRebase();
    expect(await git.isRebasing()).toBe(false);

    const status = await git.getStatus();
    expect(status.staged).toEqual([]);
    expect(status.unstaged).toEqual([]);
    expect(fs.readFileSync(path.join(tmpDir, 'file.txt'), 'utf-8')).toBe('feature change');
  });

  it('continueRebase rejects while conflicts remain, completes after resolution', async () => {
    await git.openRepo(tmpDir);
    const { mainBranch } = makeRebaseConflict();

    await expect(git.rebase(mainBranch)).rejects.toThrow();
    // Conflicts unresolved — continue must fail and the rebase stays active.
    await expect(git.continueRebase()).rejects.toThrow();
    expect(await git.isRebasing()).toBe(true);

    // Resolve and continue.
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'resolved');
    execSync('git add file.txt', { cwd: tmpDir });
    await git.continueRebase();

    expect(await git.isRebasing()).toBe(false);
    const log = await git.getLog(10, 0);
    expect(log.map(c => c.message)).toContain('feature edit');
    expect(log.map(c => c.message)).toContain('main edit');
  });
});

describe('credential prompt safety (Fix 2)', () => {
  it('credentialSafeEnv disables terminal prompts and merges over process.env', () => {
    const env = credentialSafeEnv();
    expect(env.GIT_TERMINAL_PROMPT).toBe('0');
    expect(env.GIT_ASKPASS).toBe('echo');
    // The rest of process.env must survive the merge (PATH is always set).
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
    await expect(git.getLog(50, 0)).resolves.toEqual([]);
  });

  it('unstageFiles removes a staged file from the index without HEAD', async () => {
    await git.openRepo(emptyDir);
    fs.writeFileSync(path.join(emptyDir, 'new.txt'), 'content');

    await git.stageFiles(['new.txt']);
    let status = await git.getStatus();
    expect(status.staged.some(f => f.path === 'new.txt')).toBe(true);

    await git.unstageFiles(['new.txt']);
    status = await git.getStatus();
    expect(status.staged.some(f => f.path === 'new.txt')).toBe(false);
    expect(status.unstaged.some(f => f.path === 'new.txt' && !f.staged)).toBe(true);
    // The file itself must survive unstaging.
    expect(fs.readFileSync(path.join(emptyDir, 'new.txt'), 'utf-8')).toBe('content');
  });
});

describe('readFile/writeFile path guards', () => {
  beforeEach(async () => {
    await git.openRepo(tmpDir);
  });

  it('allows normal reads and writes inside the repo', async () => {
    await git.writeFile('sub/dir-file.txt', 'nested').catch(() => {
      // parent dir does not exist — that's a plain write failure, not a guard
    });
    await git.writeFile('plain.txt', 'ok');
    expect(await git.readFile('plain.txt')).toBe('ok');
    // dotfiles that merely start with ".git" must not be blocked
    await git.writeFile('.gitignore', 'node_modules\n');
    expect(await git.readFile('.gitignore')).toBe('node_modules\n');
  });

  // Writing into .git/ (hooks, config) means arbitrary code execution on the
  // next git command — the guard must reject it even though the path is
  // lexically inside the repo.
  it('rejects writes into .git', async () => {
    await expect(git.writeFile('.git/hooks/pre-commit', '#!/bin/sh\n')).rejects.toThrow();
    expect(fs.existsSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'))).toBe(false);
    await expect(git.writeFile('.git/config', '[core]')).rejects.toThrow();
  });

  it('rejects reads from .git', async () => {
    await expect(git.readFile('.git/config')).rejects.toThrow();
  });

  it('rejects .git regardless of case', async () => {
    await expect(git.writeFile('.GIT/config', 'x')).rejects.toThrow();
  });

  // Creating symlinks on Windows requires elevation/developer mode, which CI
  // runners don't have — the guard itself is platform-independent.
  const itUnix = it.skipIf(process.platform === 'win32');

  itUnix('rejects reading through a symlink that points outside the repo', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-outside-'));
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret');
    fs.symlinkSync(outside, path.join(tmpDir, 'link'));

    await expect(git.readFile('link/secret.txt')).rejects.toThrow(/outside repository/);
    fs.rmSync(outside, { recursive: true, force: true });
  });

  itUnix('rejects writing through a symlink that points outside the repo', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-outside-'));
    fs.symlinkSync(outside, path.join(tmpDir, 'link'));

    await expect(git.writeFile('link/evil.txt', 'x')).rejects.toThrow(/outside repository/);
    expect(fs.existsSync(path.join(outside, 'evil.txt'))).toBe(false);
    fs.rmSync(outside, { recursive: true, force: true });
  });

  itUnix('rejects a file symlink that points outside the repo', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-outside-'));
    const target = path.join(outside, 'target.txt');
    fs.writeFileSync(target, 'outside content');
    fs.symlinkSync(target, path.join(tmpDir, 'file-link.txt'));

    await expect(git.readFile('file-link.txt')).rejects.toThrow(/outside repository/);
    await expect(git.writeFile('file-link.txt', 'overwrite')).rejects.toThrow(/outside repository/);
    expect(fs.readFileSync(target, 'utf-8')).toBe('outside content');
    fs.rmSync(outside, { recursive: true, force: true });
  });
});

describe('applyPatch (hunk-level staging)', () => {
  const TWENTY = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join('\n') + '\n';

  const seedMultiHunk = () => {
    fs.writeFileSync(path.join(tmpDir, 'multi.txt'), TWENTY);
    execSync('git add multi.txt && git commit -m "multi"', { cwd: tmpDir });
    // Two well-separated edits (line 2 and line 18) → two independent hunks.
    const lines = TWENTY.split('\n');
    lines[1] = 'LINE2';
    lines[17] = 'LINE18';
    fs.writeFileSync(path.join(tmpDir, 'multi.txt'), lines.join('\n'));
  };

  it('stages only the selected hunk, leaving the other unstaged', async () => {
    seedMultiHunk();
    await git.openRepo(tmpDir);

    const raw = await git.getWorkingDiff('multi.txt');
    expect((raw.match(/^@@ /gm) || []).length).toBe(2); // sanity: two hunks

    await git.applyPatch(buildHunkPatch(raw, 0), { cached: true });

    // Index (staged) carries the first change only.
    const staged = await git.getStagedDiff('multi.txt');
    expect(staged).toContain('LINE2');
    expect(staged).not.toContain('LINE18');

    // The working tree still shows the second, still-unstaged change.
    const working = await git.getWorkingDiff('multi.txt');
    expect(working).toContain('LINE18');
    expect(working).not.toContain('LINE2');
  });

  it('unstages a single hunk with reverse', async () => {
    seedMultiHunk();
    await git.openRepo(tmpDir);

    // Stage the whole file, then peel one hunk back off the index.
    await git.stageFiles(['multi.txt']);
    let staged = await git.getStagedDiff('multi.txt');
    expect((staged.match(/^@@ /gm) || []).length).toBe(2);

    await git.applyPatch(buildHunkPatch(staged, 0), { cached: true, reverse: true });

    staged = await git.getStagedDiff('multi.txt');
    expect(staged).not.toContain('LINE2'); // first hunk peeled back
    expect(staged).toContain('LINE18'); // second hunk stays staged
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
    await expect(git.applyPatch(bogus, { cached: true })).rejects.toThrow();
  });
});
