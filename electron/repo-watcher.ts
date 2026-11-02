import fs from 'fs';
import path from 'path';

const DEBOUNCE_MS = 250;

// Watch the .git directory, not the files: git replaces index and HEAD by
// atomic rename, which breaks a file watch.
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
  private root = '';

  constructor(
    private readonly onChange: () => void,
    private readonly onProblem: (
      repoRoot: string,
      detail: string,
      err?: unknown,
    ) => void = () => {},
  ) {}

  watch(repoRoot: string): void {
    this.close();
    this.root = repoRoot;

    const gitDir = path.join(repoRoot, '.git');
    try {
      if (!fs.statSync(gitDir).isDirectory()) {
        this.onProblem(
          repoRoot,
          'Not watching for changes: .git is not a folder (worktree or submodule)',
        );
        return;
      }
    } catch (err) {
      this.onProblem(repoRoot, 'Not watching for changes: .git is unreadable', err);
      return;
    }

    this.addWatcher(gitDir, false, name => (name ? isRelevantTopLevel(path.basename(name)) : true));
    this.addWatcher(path.join(gitDir, 'refs'), true, () => true);
  }

  private addWatcher(dir: string, recursive: boolean, accept: (name: string | null) => boolean) {
    const problem = (err: unknown) =>
      this.onProblem(this.root, `Not watching ${path.relative(this.root, dir)} for changes`, err);
    try {
      const watcher = fs.watch(dir, { recursive }, (_event, filename) => {
        const name = filename ? filename.toString() : null;
        if (name && path.basename(name).endsWith('.lock')) return;
        if (accept(name)) this.schedule();
      });
      watcher.on('error', problem);
      this.watchers.push(watcher);
    } catch (err) {
      problem(err);
    }
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
