import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { LogEntry, RepoIdentity } from '../../src/types';
import { setLogSink } from '../../electron/log/git-logger';

vi.mock('../../electron/auth/repo-identity', () => ({
  resolveIdentity: vi.fn(),
  clearIdentityCache: vi.fn(),
}));

const {
  runRepoTest,
  pushArgs,
  testGit: testGitFor,
} = await import('../../electron/auth/repo-test');

const REPO = '/src/p';

const identity = (over: Partial<RepoIdentity> = {}): RepoIdentity => ({
  source: 'account',
  host: 'github.com',
  login: 'octocat',
  name: null,
  avatarDataUrl: null,
  ssh: null,
  helpers: [],
  profile: null,
  ...over,
});

type Answer = string | Error;

function fakeGit(answers: Record<string, Answer>) {
  const calls: string[][] = [];
  const raw = vi.fn(async (args: string[]) => {
    calls.push(args);
    const answer = answers[args[0]] ?? '';
    if (answer instanceof Error) throw answer;
    return answer;
  });
  return { git: { raw } as never, calls };
}

const ok: Record<string, Answer> = {
  remote: 'origin\n',
  'ls-remote': 'abc\trefs/heads/main\n',
  'rev-parse': 'abc\n',
  'symbolic-ref': 'main\n',
  push: 'To github.com\n=\tHEAD:refs/heads/main\t[up to date]\nDone\n',
};

const entries: LogEntry[] = [];

beforeEach(() => {
  entries.length = 0;
  setLogSink(e => {
    if (e.status !== 'running') entries.push(e);
  });
});

const run = (answers: Record<string, Answer>, who: RepoIdentity = identity()) => {
  const fake = fakeGit(answers);
  return {
    ...fake,
    result: runRepoTest(REPO, { git: fake.git, identity: async () => who }),
  };
};

describe('runRepoTest', () => {
  it('passes who, read and write, each in its own log entry', async () => {
    const { result } = run(ok);
    const r = await result;

    expect(r.ok).toBe(true);
    expect(r.login).toBe('octocat');
    expect(r.steps.map(s => [s.step, s.ok])).toEqual([
      ['who', true],
      ['read', true],
      ['write', true],
    ]);
    const tests = entries.filter(e => e.op === 'auth-test');
    expect(tests).toHaveLength(3);
    expect(r.steps.map(s => s.logId)).toEqual(tests.map(e => e.id));
  });

  it('tests the push with a dry run that skips hooks, never a real push', async () => {
    const { result, calls } = run(ok);
    await result;

    const push = calls.find(c => c[0] === 'push');
    expect(push).toEqual(pushArgs('origin', 'main'));
    expect(push).toEqual([
      'push',
      '--dry-run',
      '--no-verify',
      '--porcelain',
      'origin',
      'HEAD:refs/heads/main',
    ]);
    expect(calls.find(c => c[0] === 'ls-remote')).toEqual(['ls-remote', '--heads', 'origin']);
  });

  it('names an auth failure from what git said', async () => {
    const { result } = run({
      ...ok,
      push: new Error("remote: No anonymous write access.\nfatal: Authentication failed for 'x'"),
    });
    const r = await result;

    expect(r.ok).toBe(false);
    const write = r.steps.find(s => s.step === 'write');
    expect(write).toMatchObject({ ok: false, reasonKind: 'auth' });
    const entry = entries.find(e => e.id === write?.logId);
    expect(entry).toMatchObject({ status: 'error', errorKind: 'auth' });
  });

  it('names a refused github.com repository on the app account as org access', async () => {
    const { result } = run({
      ...ok,
      'ls-remote': new Error(
        "remote: Repository not found.\nfatal: repository 'https://github.com/org/r.git/' not found",
      ),
    });
    const read = (await result).steps.find(s => s.step === 'read');

    expect(read).toMatchObject({ ok: false, reasonKind: 'orgAccess' });
    expect(entries.find(e => e.id === read?.logId)).toMatchObject({ errorKind: 'orgAccess' });
  });

  it('keeps a 403 on a system login as auth', async () => {
    const { result } = run(
      { ...ok, push: new Error('fatal: unable to access: The requested URL returned error: 403') },
      identity({ source: 'system' }),
    );
    expect((await result).steps.find(s => s.step === 'write')).toMatchObject({
      reasonKind: 'auth',
    });
  });

  it('reports a rejected ssh key with its reason', async () => {
    const { result } = run(
      { ...ok, 'ls-remote': new Error('git@github.com: Permission denied (publickey).') },
      identity({
        source: 'ssh',
        login: null,
        ssh: { ok: false, login: null, reason: 'key-rejected' },
      }),
    );
    const r = await result;

    expect(r.steps[0]).toMatchObject({
      step: 'who',
      ok: false,
      reasonKind: 'sshKey',
      sshReason: 'key-rejected',
    });
    expect(r.steps[1]).toMatchObject({ step: 'read', ok: false, reasonKind: 'sshKey' });
  });

  it('tells a network problem apart', async () => {
    const { result } = run({
      ...ok,
      'ls-remote': new Error('fatal: unable to access: Could not resolve host: github.com'),
    });
    expect((await result).steps[1]).toMatchObject({ ok: false, reasonKind: 'network' });
  });

  it('skips the write step on a detached HEAD', async () => {
    const { result, calls } = run({ ...ok, 'symbolic-ref': '' });
    const r = await result;

    expect(r.ok).toBe(true);
    expect(r.steps[2]).toMatchObject({ step: 'write', ok: true, skipped: 'detached' });
    expect(calls.some(c => c[0] === 'push')).toBe(false);
    expect(entries.find(e => e.id === r.steps[2].logId)?.status).toBe('info');
  });

  it('skips the write step in a repository without commits', async () => {
    const { result, calls } = run({ ...ok, 'rev-parse': '' });
    const r = await result;

    expect(r.steps[2]).toMatchObject({ step: 'write', skipped: 'no-commits' });
    expect(calls.some(c => c[0] === 'push')).toBe(false);
  });

  it('counts a branch behind the remote as write access', async () => {
    const { result } = run({
      ...ok,
      push: new Error('To x\n!\tHEAD:refs/heads/main\t[rejected] (fetch first)\nDone\n'),
    });
    expect((await result).steps[2]).toMatchObject({ ok: true, behind: true });
  });

  it('fails who without anything to sign in with, and still tries read and write', async () => {
    const { result, calls } = run(ok, identity({ source: 'none', login: null }));
    const r = await result;

    expect(r.steps[0]).toMatchObject({ ok: false, reasonKind: 'auth' });
    expect(calls.some(c => c[0] === 'push')).toBe(true);
  });

  it('fails who when the service rejected the stored credential', async () => {
    const { result } = run(ok, identity({ source: 'system', login: null, profile: 'rejected' }));
    const r = await result;
    expect(r.ok).toBe(false);
    expect(r.steps[0]).toMatchObject({ step: 'who', ok: false, reasonKind: 'auth' });
  });

  it('keeps who passing when the service could not be asked', async () => {
    const { result } = run(ok, identity({ source: 'system', login: null, profile: 'unavailable' }));
    expect((await result).steps[0]).toMatchObject({ step: 'who', ok: true });
  });

  it('refuses a repository without a remote', async () => {
    const { result } = run({ ...ok, remote: '' });
    await expect(result).rejects.toThrow(/no remote/);
  });
});

describe('runRepoTest against a real local remote', () => {
  let dir: string;
  let repo: string;
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd: repo,
      stdio: 'pipe',
    });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-authtest-'));
    repo = path.join(dir, 'repo');
    execFileSync('git', ['init', '--bare', path.join(dir, 'remote.git')]);
    fs.mkdirSync(repo);
    git('init', '-b', 'main');
    git('remote', 'add', 'origin', path.join(dir, 'remote.git'));
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('skips the write step before the first commit', async () => {
    const r = await runRepoTest(repo, {
      git: testGitFor(repo),
      identity: async () => identity(),
    });
    expect(r.steps.map(s => [s.step, s.ok, s.skipped])).toEqual([
      ['who', true, undefined],
      ['read', true, undefined],
      ['write', true, 'no-commits'],
    ]);
  });

  it('dry-runs the push without sending anything', async () => {
    git('commit', '--allow-empty', '-m', 'one');
    const r = await runRepoTest(repo, { git: testGitFor(repo), identity: async () => identity() });

    expect(r.ok).toBe(true);
    expect(r.steps[2]).toMatchObject({ step: 'write', ok: true });
    const heads = execFileSync('git', ['ls-remote', '--heads', path.join(dir, 'remote.git')]);
    expect(String(heads)).toBe('');
  });

  it('skips the write step on a detached HEAD', async () => {
    git('commit', '--allow-empty', '-m', 'one');
    git('checkout', '--detach');
    const r = await runRepoTest(repo, { git: testGitFor(repo), identity: async () => identity() });
    expect(r.steps[2]).toMatchObject({ skipped: 'detached' });
  });
});
