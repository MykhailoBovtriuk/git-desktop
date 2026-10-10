import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { LogStore, repoFolderName } from '../../electron/log/log-store';
import type { LogEntry } from '../../src/types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 4, 12).getTime();
const REPO = '/work/MyTestProject';
const OTHER = '/elsewhere/MyTestProject';

function entry(ts: number, repoPath = REPO, id = `${repoPath}:${ts}`): LogEntry {
  return { id, ts, repoPath, op: 'push', status: 'success', commands: [] };
}

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-logs-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function files(repoPath = REPO): string[] {
  const dir = path.join(root, repoFolderName(repoPath));
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(n => n.endsWith('.jsonl'))
    .sort();
}

describe('repoFolderName', () => {
  it('names the folder after the repository and tells same-named ones apart', () => {
    const a = repoFolderName(REPO, 'darwin');
    const b = repoFolderName(OTHER, 'darwin');
    expect(a).toMatch(/^MyTestProject-[0-9a-f]{6}$/);
    expect(b).toMatch(/^MyTestProject-[0-9a-f]{6}$/);
    expect(a).not.toBe(b);
  });

  it('cannot be steered out of the logs folder', () => {
    expect(repoFolderName('/x/..', 'linux')).toMatch(/^repo-[0-9a-f]{6}$/);
    expect(repoFolderName('C:\\Users\\me\\My Repo\\', 'win32')).toMatch(/^My_Repo-[0-9a-f]{6}$/);
  });

  it('ignores case on Windows only', () => {
    const hash = (p: string, platform: NodeJS.Platform) => repoFolderName(p, platform).slice(-6);
    expect(hash('C:\\Repo', 'win32')).toBe(hash('c:\\repo', 'win32'));
    expect(hash('/Repo', 'linux')).not.toBe(hash('/repo', 'linux'));
  });
});

describe('LogStore', () => {
  it('creates a folder with the repository path when it is opened', async () => {
    const store = new LogStore(root, () => NOW);
    await store.ensureRepo(REPO);
    const meta = path.join(root, repoFolderName(REPO), 'meta.json');
    expect(JSON.parse(fs.readFileSync(meta, 'utf8'))).toEqual({ path: REPO });
  });

  it('keeps each repository in its own folder, one file per day', async () => {
    const store = new LogStore(root, () => NOW);
    await store.init();
    expect(store.getRetention()).toBe('week');
    await store.append(entry(NOW - DAY));
    await store.append(entry(NOW));
    await store.append(entry(NOW, OTHER));
    expect(files()).toEqual(['2026-10-03.jsonl', '2026-10-04.jsonl']);
    expect(files(OTHER)).toEqual(['2026-10-04.jsonl']);
    expect((await store.list(REPO)).map(e => e.ts)).toEqual([NOW, NOW - DAY]);
    expect((await store.list(OTHER)).map(e => e.repoPath)).toEqual([OTHER]);
  });

  it('does not store running entries', async () => {
    const store = new LogStore(root, () => NOW);
    await store.append({ ...entry(NOW), status: 'running' });
    expect(files()).toEqual([]);
    expect(await store.list(REPO)).toEqual([]);
  });

  it('pages with `before`', async () => {
    const store = new LogStore(root, () => NOW);
    for (let i = 0; i < 5; i++) await store.append(entry(NOW - i * 1000));
    const page = await store.list(REPO, NOW - 1000, 2);
    expect(page.map(e => e.ts)).toEqual([NOW - 2000, NOW - 3000]);
  });

  it('prunes day files outside the retention window in every repository', async () => {
    const store = new LogStore(root, () => NOW);
    await store.append(entry(NOW - 10 * DAY));
    await store.append(entry(NOW - 3 * DAY));
    await store.append(entry(NOW));
    await store.append(entry(NOW - 10 * DAY, OTHER));
    await store.prune();
    expect(files()).toEqual(['2026-10-01.jsonl', '2026-10-04.jsonl']);
    expect(files(OTHER)).toEqual([]);

    await store.setRetention('day');
    expect(files()).toEqual(['2026-10-04.jsonl']);
  });

  it('keeps everything with forever, and remembers the choice', async () => {
    const store = new LogStore(root, () => NOW);
    await store.setRetention('forever');
    await store.append(entry(NOW - 400 * DAY));
    await store.prune();
    expect(files()).toHaveLength(1);

    const reopened = new LogStore(root, () => NOW);
    await reopened.init();
    expect(reopened.getRetention()).toBe('forever');
  });

  it('session writes nothing to disk and drops what was there', async () => {
    const store = new LogStore(root, () => NOW);
    await store.append(entry(NOW - 1000));
    await store.setRetention('session');
    expect(files()).toEqual([]);
    await store.append(entry(NOW));
    await store.append(entry(NOW, OTHER));
    expect(files()).toEqual([]);
    expect((await store.list(REPO)).map(e => e.ts)).toEqual([NOW, NOW - 1000]);
  });

  it('reports size and clears one repository only', async () => {
    const store = new LogStore(root, () => NOW);
    await store.append(entry(NOW));
    await store.append(entry(NOW + 1));
    await store.append(entry(NOW, OTHER));
    const stats = await store.stats(REPO);
    expect(stats.entries).toBe(2);
    expect(stats.bytes).toBeGreaterThan(0);
    await store.clear(REPO);
    expect(files()).toEqual([]);
    expect(await store.list(REPO)).toEqual([]);
    expect(await store.list(OTHER)).toHaveLength(1);
  });

  it('forgetting a repository deletes its folder', async () => {
    const store = new LogStore(root, () => NOW);
    await store.ensureRepo(REPO);
    await store.append(entry(NOW));
    await store.append(entry(NOW, OTHER));
    await store.forgetRepo(REPO);
    expect(fs.existsSync(path.join(root, repoFolderName(REPO)))).toBe(false);
    expect(await store.list(REPO)).toEqual([]);
    expect(files(OTHER)).toHaveLength(1);
  });

  it('drops the old shared day files on start', async () => {
    fs.writeFileSync(path.join(root, '2026-10-01.jsonl'), '{}\n');
    const store = new LogStore(root, () => NOW);
    await store.init();
    expect(fs.existsSync(path.join(root, '2026-10-01.jsonl'))).toBe(false);
  });

  it('skips a torn last line', async () => {
    const store = new LogStore(root, () => NOW);
    await store.append(entry(NOW));
    fs.appendFileSync(path.join(root, repoFolderName(REPO), '2026-10-04.jsonl'), '{"id":"half');
    expect(await store.list(REPO)).toHaveLength(1);
  });
});
