import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadPty } from '../../electron/terminal/pty-loader';
import { detectShells, type ShellSpec } from '../../electron/terminal/shell';
import { TerminalManager, trimBuffer } from '../../electron/terminal/terminal-manager';

const { pty } = loadPty();
const win = process.platform === 'win32';
// A plain, non-login shell keeps the test away from the developer's dotfiles.
const testShell: ShellSpec[] = win
  ? detectShells().filter(s => s.id === 'cmd')
  : [{ id: 'sh', label: 'sh', path: '/bin/sh', args: [] }];

const managers: TerminalManager[] = [];
afterEach(() => managers.splice(0).forEach(m => m.killAll()));

function setup() {
  const data = new Map<string, string>();
  const exits = new Map<string, number>();
  const manager = new TerminalManager(pty!, () => testShell, {
    data: (id, chunk) => data.set(id, (data.get(id) ?? '') + chunk),
    exit: (id, code) => exits.set(id, code),
  });
  managers.push(manager);
  return { manager, data, exits };
}

async function until(check: () => boolean, ms = 5000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise(r => setTimeout(r, 20));
  }
}

describe('trimBuffer', () => {
  it('keeps the tail, cut at a line start', () => {
    expect(trimBuffer('abc', 10)).toBe('abc');
    expect(trimBuffer('line one\nline two\n', 12)).toBe('line two\n');
  });
});

describe.skipIf(!pty || testShell.length === 0)('TerminalManager (real pty)', () => {
  it('runs a shell in the repository folder and streams its output', async () => {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-term-')));
    const { manager, data } = setup();
    const session = manager.create({ repoPath: dir, cols: 80, rows: 24 });
    expect(manager.list(dir)).toEqual([session]);

    manager.write(session.id, win ? 'cd\r' : 'pwd\r');
    await until(() => (data.get(session.id) ?? '').includes(path.basename(dir)));
    expect(manager.buffer(session.id)).toContain(path.basename(dir));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports the exit and forgets the session', async () => {
    const { manager, exits } = setup();
    const session = manager.create({ repoPath: os.tmpdir(), cols: 80, rows: 24 });
    manager.write(session.id, 'exit 3\r');
    await until(() => exits.has(session.id));
    expect(exits.get(session.id)).toBe(3);
    expect(manager.list(os.tmpdir())).toEqual([]);
  });

  it('kills only the sessions of the repository being removed', async () => {
    const a = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-a-'));
    const b = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-b-'));
    const { manager, exits } = setup();
    const inA = manager.create({ repoPath: a, cols: 80, rows: 24 });
    const inB = manager.create({ repoPath: b, cols: 80, rows: 24 });
    manager.killRepo(a);
    await until(() => exits.has(inA.id));
    expect(exits.has(inB.id)).toBe(false);
    expect(manager.list(b)).toHaveLength(1);
  });

  it('refuses a folder that no longer exists', () => {
    const { manager } = setup();
    expect(() =>
      manager.create({
        repoPath: path.join(os.tmpdir(), 'gone-' + Date.now()),
        cols: 80,
        rows: 24,
      }),
    ).toThrow(/no longer exists/);
  });

  it('rejects unknown session ids', () => {
    const { manager } = setup();
    expect(() => manager.write('nope', 'x')).toThrow(/No such terminal/);
  });
});
