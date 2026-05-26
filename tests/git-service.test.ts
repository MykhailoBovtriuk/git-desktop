import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { GitService } from '../electron/git-service';

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
    const current = branches.find((b) => b.current);
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
    expect(status.staged.some((f) => f.path === 'new.txt')).toBe(true);

    await git.unstageFiles(['new.txt']);
    status = await git.getStatus();
    expect(status.staged.some((f) => f.path === 'new.txt')).toBe(false);
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
    expect(branches.find((b) => b.current)!.name).toBe('develop');
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
    expect(files.some((f) => f.path === 'file.txt')).toBe(true);
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
});
