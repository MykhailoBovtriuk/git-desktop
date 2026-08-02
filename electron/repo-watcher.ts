import fs from 'fs';
import path from 'path';

// Debounce window: a single git command (commit, checkout, fetch) touches many
// files under .git in quick succession; collapse the burst into one refresh.
const DEBOUNCE_MS = 250;

// Top-level .git entries whose change means the repo state moved. We watch the
// .git *directory* rather than these files directly because git replaces index
// and HEAD by atomic rename, which detaches a file-level fs.watch from the new
// inode — a directory watch keeps firing across the swap.
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

/**
 * Watches a repository's .git directory and invokes `onChange` (debounced) when
 * anything that affects the working state changes — commits, checkouts, ref
 * updates, rebase/merge progress — including changes made outside the app (CLI,
 * IDE). Renderer subscribes via preload's onGitChanged.
 */
export class RepoWatcher {
  private watchers: fs.FSWatcher[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly onChange: () => void) {}

  /** (Re)point the watcher at a new repo root. Safe to call repeatedly. */
  watch(repoRoot: string): void {
    this.close();

    const gitDir = path.join(repoRoot, '.git');
    try {
      // A linked worktree or submodule stores .git as a *file* pointing at the
      // real git dir; we only handle the common directory case here.
      if (!fs.statSync(gitDir).isDirectory()) return;
    } catch {
      return; // no .git — nothing to watch
    }

    // Top level: HEAD, index, MERGE_HEAD, rebase-* dirs, packed-refs, …
    this.addWatcher(gitDir, false, name => (name ? isRelevantTopLevel(path.basename(name)) : true));
    // refs/*: loose branch/tag/remote ref updates (recursive; unsupported on
    // some platforms — the addWatcher try/catch degrades gracefully to the
    // top-level watch plus the fallback poll in useAutoRefresh).
    this.addWatcher(path.join(gitDir, 'refs'), true, () => true);
  }

  private addWatcher(dir: string, recursive: boolean, accept: (name: string | null) => boolean) {
    try {
      const watcher = fs.watch(dir, { recursive }, (_event, filename) => {
        const name = filename ? filename.toString() : null;
        // Lock files churn during every git operation and never represent a
        // settled state — ignore them to avoid refreshing mid-write.
        if (name && path.basename(name).endsWith('.lock')) return;
        if (accept(name)) this.schedule();
      });
      // A watched dir being removed (e.g. rebase-merge cleanup) surfaces as an
      // error on some platforms; swallow it rather than crash the main process.
      watcher.on('error', () => {});
      this.watchers.push(watcher);
    } catch {
      // Directory missing or recursive unsupported — skip this watcher.
    }
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.onChange();
    }, DEBOUNCE_MS);
  }

  /** Stop all watchers and cancel any pending debounced callback. */
  close(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const watcher of this.watchers) {
      try {
        watcher.close();
      } catch {
        // already closed
      }
    }
    this.watchers = [];
  }
}
