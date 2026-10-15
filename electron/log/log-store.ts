import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { LOG_RETENTIONS } from '../../src/types';
import type { LogEntry, LogRetention, LogStats } from '../../src/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const KEEP_DAYS: Record<Exclude<LogRetention, 'session'>, number> = {
  day: 1,
  week: 7,
  month: 30,
  forever: Infinity,
};
export const DEFAULT_RETENTION: LogRetention = 'week';
const SESSION_CAP = 2000;
const CONFIG_FILE = 'config.json';
const META_FILE = 'meta.json';
const DAY_FILE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;

function dayKey(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayEnd(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d + 1).getTime();
}

export function isLogRetention(value: unknown): value is LogRetention {
  return typeof value === 'string' && (LOG_RETENTIONS as readonly string[]).includes(value);
}

/**
 * The folder a repository's log lives in: its name to be found by eye, a hash
 * of its path so two "app" checkouts never share one. Derived, never taken
 * from the caller, so no path can walk out of the logs directory.
 */
export function repoFolderName(repoPath: string, platform = process.platform): string {
  const key = platform === 'win32' ? repoPath.toLowerCase() : repoPath;
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 6);
  // Split by hand: a Windows path read on any platform still ends at its last
  // separator, whichever slash that is.
  const last =
    repoPath
      .split(/[\\/]+/)
      .filter(Boolean)
      .pop() ?? '';
  const name = last
    .replace(/[^\w.-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 40);
  return `${name || 'repo'}-${hash}`;
}

export class LogStore {
  private retention: LogRetention = DEFAULT_RETENTION;
  private session: LogEntry[] = [];
  private writes: Promise<void> = Promise.resolve();

  constructor(
    private readonly root: string | null,
    private readonly now: () => number = Date.now,
  ) {}

  async init(): Promise<void> {
    if (!this.root) return;
    try {
      const raw = JSON.parse(await fs.readFile(path.join(this.root, CONFIG_FILE), 'utf8'));
      if (isLogRetention(raw?.retention)) this.retention = raw.retention;
    } catch {}
    // Day files straight under the root come from before logs were per repository.
    for (const name of await fs.readdir(this.root).catch(() => [] as string[])) {
      if (DAY_FILE.test(name)) await fs.rm(path.join(this.root, name), { force: true });
    }
    await this.prune();
  }

  getRetention(): LogRetention {
    return this.retention;
  }

  async setRetention(retention: LogRetention): Promise<void> {
    this.retention = retention;
    if (!this.root) return;
    await fs.mkdir(this.root, { recursive: true });
    await fs.writeFile(path.join(this.root, CONFIG_FILE), JSON.stringify({ retention }));
    await this.prune();
  }

  repoDir(repoPath: string): string | null {
    return this.root ? path.join(this.root, repoFolderName(repoPath)) : null;
  }

  async ensureRepo(repoPath: string): Promise<void> {
    const dir = this.repoDir(repoPath);
    if (!dir) return;
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, META_FILE), JSON.stringify({ path: repoPath }));
  }

  async forgetRepo(repoPath: string): Promise<void> {
    await this.writes;
    this.session = this.session.filter(e => e.repoPath !== repoPath);
    const dir = this.repoDir(repoPath);
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  }

  append(entry: LogEntry): Promise<void> {
    if (entry.status === 'running') return Promise.resolve();
    this.session.push(entry);
    if (this.session.length > SESSION_CAP)
      this.session.splice(0, this.session.length - SESSION_CAP);
    const dir = entry.repoPath ? this.repoDir(entry.repoPath) : null;
    if (!dir || this.retention === 'session') return Promise.resolve();
    const line = JSON.stringify(entry) + '\n';
    const file = path.join(dir, `${dayKey(entry.ts)}.jsonl`);
    // Serialised so two quick operations never interleave half lines.
    this.writes = this.writes
      .then(() => fs.mkdir(dir, { recursive: true }))
      .then(() => fs.appendFile(file, line))
      .catch(() => {});
    return this.writes;
  }

  async list(repoPath: string, before = Infinity, limit = 200): Promise<LogEntry[]> {
    await this.writes;
    const dir = this.repoDir(repoPath);
    if (!dir || this.retention === 'session') {
      return this.session
        .filter(e => e.repoPath === repoPath && e.ts < before)
        .sort((a, b) => b.ts - a.ts)
        .slice(0, limit);
    }
    const cutoff = this.cutoff();
    const out: LogEntry[] = [];
    for (const key of (await this.dayFiles(dir)).reverse()) {
      if (dayEnd(key) <= cutoff) break;
      const entries = await this.readDay(dir, key);
      for (let i = entries.length - 1; i >= 0 && out.length < limit; i--) {
        const e = entries[i];
        if (e.ts < before && e.ts >= cutoff) out.push(e);
      }
      if (out.length >= limit) break;
    }
    return out;
  }

  async stats(repoPath: string): Promise<LogStats> {
    await this.writes;
    const dir = this.repoDir(repoPath);
    if (!dir || this.retention === 'session') {
      const mine = this.session.filter(e => e.repoPath === repoPath);
      const bytes = mine.reduce((n, e) => n + JSON.stringify(e).length + 1, 0);
      return { bytes, entries: mine.length };
    }
    let bytes = 0;
    let entries = 0;
    for (const key of await this.dayFiles(dir)) {
      const text = await fs.readFile(path.join(dir, `${key}.jsonl`), 'utf8').catch(() => '');
      bytes += Buffer.byteLength(text);
      entries += text.split('\n').filter(Boolean).length;
    }
    return { bytes, entries };
  }

  async clear(repoPath: string): Promise<void> {
    await this.writes;
    this.session = this.session.filter(e => e.repoPath !== repoPath);
    const dir = this.repoDir(repoPath);
    if (!dir) return;
    for (const key of await this.dayFiles(dir)) {
      await fs.rm(path.join(dir, `${key}.jsonl`), { force: true });
    }
  }

  async prune(): Promise<void> {
    if (!this.root) return;
    await this.writes;
    const cutoff = this.cutoff();
    const folders = await fs.readdir(this.root, { withFileTypes: true }).catch(() => []);
    for (const folder of folders) {
      if (!folder.isDirectory()) continue;
      const dir = path.join(this.root, folder.name);
      for (const key of await this.dayFiles(dir)) {
        if (dayEnd(key) <= cutoff) await fs.rm(path.join(dir, `${key}.jsonl`), { force: true });
      }
    }
  }

  private cutoff(): number {
    if (this.retention === 'session') return Infinity;
    const days = KEEP_DAYS[this.retention];
    return days === Infinity ? -Infinity : this.now() - days * DAY_MS;
  }

  private async dayFiles(dir: string): Promise<string[]> {
    const names = await fs.readdir(dir).catch(() => [] as string[]);
    return names
      .map(n => DAY_FILE.exec(n)?.[1])
      .filter((k): k is string => !!k)
      .sort();
  }

  private async readDay(dir: string, key: string): Promise<LogEntry[]> {
    const text = await fs.readFile(path.join(dir, `${key}.jsonl`), 'utf8').catch(() => '');
    const out: LogEntry[] = [];
    for (const line of text.split('\n')) {
      if (!line) continue;
      // A crash mid-append leaves a torn last line; skip it, keep the rest.
      try {
        out.push(JSON.parse(line) as LogEntry);
      } catch {}
    }
    // Lines land when an operation ends, so one that started earlier but ran
    // longer is written after a quicker one.
    return out.sort((a, b) => a.ts - b.ts);
  }
}
