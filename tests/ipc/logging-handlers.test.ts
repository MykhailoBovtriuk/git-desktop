import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { LogEntry } from '../../src/types';

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => Promise<unknown>>());

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => Promise<unknown>) =>
      handlers.set(channel, fn),
  },
  shell: { openPath: vi.fn(), openExternal: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
}));

const { GitContext } = await import('../../electron/git/context');
const { registerMergeHandlers } = await import('../../electron/ipc/merge');
const { registerRepoHandlers } = await import('../../electron/ipc/repo');
const { registerLogHandlers } = await import('../../electron/ipc/logs');
const { logEvent, setLogSink } = await import('../../electron/log/git-logger');

const call = (channel: string, ...args: unknown[]) => handlers.get(channel)!({}, ...args);

let tmp: string;
let seen: LogEntry[];

beforeEach(() => {
  handlers.clear();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-logging-'));
});

afterEach(() => {
  setLogSink(() => {});
  fs.rmSync(tmp, { recursive: true, force: true });
});

function listen() {
  seen = [];
  setLogSink(e => seen.push(e));
}

function conflictingRepo(): string {
  const git = (cmd: string) => execSync(`git ${cmd}`, { cwd: tmp, stdio: 'pipe' });
  git('init -b main');
  git('config user.email t@t');
  git('config user.name T');
  fs.writeFileSync(path.join(tmp, 'f.txt'), 'base\n');
  git('add . && git commit -m base');
  git('checkout -b other');
  fs.writeFileSync(path.join(tmp, 'f.txt'), 'other\n');
  git('commit -am other');
  git('checkout main');
  fs.writeFileSync(path.join(tmp, 'f.txt'), 'main\n');
  git('commit -am main');
  return fs.realpathSync(tmp);
}

describe('logging at the IPC boundary', () => {
  it('records a merge that stops on conflicts as a warning, not a success', async () => {
    const root = conflictingRepo();
    const ctx = new GitContext();
    await ctx.openRepo(root);
    registerMergeHandlers(ctx);
    listen();

    const result = await call('git:merge', 'other');
    expect(result).toEqual({ data: { conflicts: ['f.txt'] } });
    const done = seen[seen.length - 1];
    expect(done.op).toBe('merge');
    expect(done.status).toBe('warning');
    expect(done.error).toContain('f.txt');
  });

  it('logs a folder that is not a repository to the app log, with its id in the reply', async () => {
    registerRepoHandlers(new GitContext());
    listen();

    const result = (await call('git:open-repo', tmp)) as { error: string; logId: string };
    expect(result.error).toMatch(/not a Git repository/);
    const done = seen[seen.length - 1];
    expect(done).toMatchObject({ op: 'open-repo', repoPath: null, status: 'error' });
    expect(result.logId).toBe(done.id);
  });

  it('logs nothing when a read succeeds', async () => {
    const root = conflictingRepo();
    const ctx = new GitContext();
    await ctx.openRepo(root);
    registerRepoHandlers(ctx);
    listen();
    await call('git:get-status');
    expect(seen).toEqual([]);
  });

  it('accepts renderer reports only for known operations, attributed to the open repository', async () => {
    registerLogHandlers({ getRepoPath: () => '/work/app' });
    listen();

    expect(await call('log:report', 'push', 'x')).toEqual({ error: 'Invalid argument: op' });
    await call('log:report', 'ui-crash', 'Cannot read x of undefined\nmore', 'at Foo');
    const done = seen[seen.length - 1];
    expect(done).toMatchObject({
      op: 'ui-crash',
      repoPath: '/work/app',
      status: 'error',
      detail: 'Cannot read x of undefined',
    });
    expect(done.error).toContain('at Foo');
  });

  it('lets the renderer mark a logged failure only with an allowed kind', async () => {
    registerLogHandlers();
    listen();
    const id = logEvent({ op: 'push', repoPath: '/work/app', status: 'error', error: 'x' });

    expect(await call('log:mark-kind', 'not-an-id', 'orgAccess')).toEqual({
      error: 'Invalid argument: id',
    });
    expect(await call('log:mark-kind', id, 'auth')).toEqual({ error: 'Invalid argument: kind' });
    expect(seen).toHaveLength(1);

    expect(await call('log:mark-kind', id, 'orgAccess')).toEqual({ data: true });
    expect(seen[1]).toMatchObject({ id, errorKind: 'orgAccess' });
  });
});
