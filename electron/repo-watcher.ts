import fs from 'fs';
import path from 'path';

const DEBOUNCE_MS = 250;

// We watch the .git *directory* rather than these files directly because git
// replaces index and HEAD by atomic rename, which detaches a file-level
// fs.watch from the new inode — a directory watch keeps firing across the swap.
const RELEVANT_TOP_LEVEL = new Set([
  'HEAD',
  'index',
  'ORIG_HEAD',
  'MERGE_HEAD',
  'FETCH_HEAD',
  'packed-refs',
]);

const isRelevantTopLevel = (name: string): boolean =>
  RELEVANT_TOP_LEVEL.has(name) || name.startsWith('rebase-');

export class RepoWatcher {
  private watchers: fs.FSWatcher[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly onChange: () => void) {}

  watch(repoRoot: string): void {
    this.close();

    const gitDir = path.join(repoRoot, '.git');
    try {
      if (!fs.statSync(gitDir).isDirectory()) return;
    } catch {
      return;
    }

    this.addWatcher(gitDir, false, name => (name ? isRelevantTopLevel(path.basename(name)) : true));
    this.addWatcher(path.join(gitDir, 'refs'), true, () => true);
  }

  private addWatcher(dir: string, recursive: boolean, accept: (name: string | null) => boolean) {
    try {
      const watcher = fs.watch(dir, { recursive }, (_event, filename) => {
        const name = filename ? filename.toString() : null;
        if (name && path.basename(name).endsWith('.lock')) return;
        if (accept(name)) this.schedule();
      });
      watcher.on('error', () => {});
      this.watchers.push(watcher);
    } catch {}
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.onChange();
    }, DEBOUNCE_MS);
  }

  close(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const watcher of this.watchers) {
      try {
        watcher.close();
      } catch {}
    }
    this.watchers = [];
  }
}
