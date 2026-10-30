import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GitContext } from '../../electron/git/context';
import * as branchesGit from '../../electron/git/branches';
import * as statusGit from '../../electron/git/status';
import { logged, setLogSink } from '../../electron/log/git-logger';
import type { LogEntry } from '../../src/types';

let tmpDir: string;
let git: GitContext;
let seen: LogEntry[];

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-log-'));
  execSync('git init', { cwd: tmpDir });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir });
  execSync('git config user.name "Test"', { cwd: tmpDir });
  fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'hello');
  execSync('git add . && git commit -m "initial"', { cwd: tmpDir });
  git = new GitContext();
  await git.openRepo(tmpDir);
  seen = [];
  setLogSink(e => seen.push(e));
});

afterEach(() => {
  setLogSink(() => {});
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('logged', () => {
  it('announces a running entry, then settles it with the git output', async () => {
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'changed');
    await logged('commit', tmpDir, 'second', async () => {
      await statusGit.stageFiles(git, ['file.txt']);
      return statusGit.commit(git, 'second');
    });

    expect(seen.map(e => e.status)).toEqual(['running', 'success']);
    const done = seen[1];
    expect(done.id).toBe(seen[0].id);
    expect(done.op).toBe('commit');
    expect(done.detail).toBe('second');
    expect(done.durationMs).toBeGreaterThanOrEqual(0);
    const commit = done.commands.find(c => c.argv.includes('commit'));
    expect(commit?.argv[0]).toBe('git');
    expect(commit?.stdout).toContain('second');
  });

  it('ignores git output from work running outside an entry', async () => {
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const op = logged('fetch', tmpDir, undefined, async () => {
      await gate;
      return null;
    });
    await statusGit.getStatus(git);
    release();
    await op;
    expect(seen[1].commands).toEqual([]);
  });

  it('records the failure and rethrows it', async () => {
    await expect(
      logged('checkout', tmpDir, 'nope', () => branchesGit.checkout(git, 'nope')),
    ).rejects.toThrow();
    const done = seen[seen.length - 1];
    expect(done.status).toBe('error');
    expect(done.error).toBeTruthy();
    expect(done.commands.some(c => c.stderr.length > 0)).toBe(true);
  });
});
