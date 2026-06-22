import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import type { Commit, Branch, GitStatus, FileStatus, AheadBehind, StashEntry } from '../src/types';

export class GitService {
  private git: SimpleGit | null = null;
  private repoPath: string | null = null;

  async openRepo(dirPath: string): Promise<string> {
    const git = simpleGit(dirPath);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new Error('Selected folder is not a Git repository');
    }
    // Normalize to the repository root so file paths (status/diff are relative
    // to the root) and recent-repo entries are canonical, even when the user
    // picked a subfolder inside the repo.
    const root = (await git.revparse(['--show-toplevel'])).trim();
    this.repoPath = root;
    this.git = simpleGit(root);
    return root;
  }

  private ensureRepo(): SimpleGit {
    if (!this.git) throw new Error('No repository opened');
    return this.git;
  }

  private resolveRepoPath(filePath: string): string {
    if (!this.repoPath) throw new Error('No repository opened');
    if (typeof filePath !== 'string' || filePath.length === 0) {
      throw new Error('Invalid file path');
    }
    if (path.isAbsolute(filePath)) {
      throw new Error('Path is outside repository');
    }
    const repoRoot = path.resolve(this.repoPath);
    const abs = path.resolve(repoRoot, filePath);
    if (abs !== repoRoot && !abs.startsWith(repoRoot + path.sep)) {
      throw new Error('Path is outside repository');
    }
    return abs;
  }

  async getLog(limit: number, offset: number): Promise<Commit[]> {
    const git = this.ensureRepo();
    const result = await git.raw([
      'log',
      '--all',
      '--topo-order',
      `--max-count=${limit}`,
      `--skip=${offset}`,
      '--format=%H%x00%s%x00%an%x00%aI%x00%P%x00%D',
    ]);

    return result
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, message, author, date, parents, refs] = line.split('\x00');
        return {
          hash,
          abbreviatedHash: hash.slice(0, 7),
          message,
          author,
          date,
          parents: parents ? parents.split(' ').filter(Boolean) : [],
          refs: refs ? refs.split(',').map((r) => r.trim()).filter(Boolean) : [],
        };
      });
  }

  async getBranches(): Promise<Branch[]> {
    const git = this.ensureRepo();
    const summary = await git.branch(['-a']);
    const branches: Branch[] = [];

    for (const [name, info] of Object.entries(summary.branches)) {
      const isRemote = name.startsWith('remotes/');
      const cleanName = isRemote ? name.replace('remotes/', '') : name;
      branches.push({
        name: cleanName,
        current: info.current,
        remote: isRemote,
      });
    }

    return branches;
  }

  async getStatus(): Promise<GitStatus & { ahead: number; behind: number }> {
    const git = this.ensureRepo();
    const status = await git.status();

    const staged: FileStatus[] = [];
    const unstaged: FileStatus[] = [];
    const conflicted = new Set(status.conflicted);

    for (const file of status.files) {
      if (conflicted.has(file.path)) {
        unstaged.push({ path: file.path, status: 'U', staged: false });
        continue;
      }

      const stagedCode = file.index;
      const unstagedCode = file.working_dir;

      if (stagedCode && stagedCode !== ' ' && stagedCode !== '?') {
        staged.push({ path: file.path, status: this.mapStatus(stagedCode), staged: true });
      }

      if (unstagedCode && unstagedCode !== ' ') {
        unstaged.push({
          path: file.path,
          status: unstagedCode === '?' ? 'N' : this.mapStatus(unstagedCode),
          staged: false,
        });
      }
    }

    return { staged, unstaged, ahead: status.ahead, behind: status.behind };
  }

  private mapStatus(code: string): FileStatus['status'] {
    const map: Record<string, FileStatus['status']> = {
      A: 'A', M: 'M', D: 'D', R: 'R', C: 'C', U: 'U', '?': 'N',
    };
    return map[code] ?? 'M';
  }

  async stageFiles(paths: string[]): Promise<void> {
    await this.ensureRepo().add(paths);
  }

  async unstageFiles(paths: string[]): Promise<void> {
    await this.ensureRepo().raw(['restore', '--staged', '--', ...paths]);
  }

  async discardChanges(paths: string[]): Promise<void> {
    const git = this.ensureRepo();
    const status = await git.status();
    const untracked = new Set(status.not_added);
    const trackedPaths = paths.filter((p) => !untracked.has(p));
    const untrackedPaths = paths.filter((p) => untracked.has(p));
    // Tracked changes/deletions are restored from HEAD; `git checkout` cannot
    // remove untracked files, so those are deleted with `clean` (-d to also
    // remove fully-untracked directories).
    if (trackedPaths.length) {
      await git.checkout(['--', ...trackedPaths]);
    }
    if (untrackedPaths.length) {
      await git.raw(['clean', '-f', '-d', '--', ...untrackedPaths]);
    }
  }

  async commit(message: string): Promise<string> {
    const result = await this.ensureRepo().commit(message);
    return result.commit;
  }

  async fetch(): Promise<void> {
    await this.ensureRepo().fetch();
  }

  async pull(): Promise<string> {
    const result = await this.ensureRepo().pull();
    const s = result.summary ?? { changes: 0, insertions: 0, deletions: 0 };
    const ch = s.changes ?? 0, ins = s.insertions ?? 0, del = s.deletions ?? 0;
    if (ch === 0 && ins === 0 && del === 0) return 'Already up to date';
    return `${ch} changes, ${ins} insertions, ${del} deletions`;
  }

  async push(): Promise<void> {
    await this.ensureRepo().push();
  }

  async checkout(branch: string): Promise<void> {
    await this.ensureRepo().checkout(branch);
  }

  async checkoutForce(branch: string): Promise<void> {
    await this.ensureRepo().checkout(['-f', branch]);
  }

  async merge(branch: string): Promise<{ success: boolean; conflicts: string[] }> {
    try {
      await this.ensureRepo().merge([branch]);
      return { success: true, conflicts: [] };
    } catch (err) {
      // Derive conflicting files from status (string paths) rather than the
      // error shape: simple-git's err.git.conflicts holds objects, and a retry
      // while already mid-conflict throws an error with no conflict info at all.
      const conflicts = (await this.ensureRepo().status()).conflicted;
      if (conflicts.length) {
        return { success: false, conflicts };
      }
      throw err;
    }
  }

  async isMerging(): Promise<boolean> {
    // With --quiet, simple-git does NOT throw when MERGE_HEAD is absent (it
    // resolves with empty output), so check the output: a real MERGE_HEAD
    // prints its SHA, otherwise it's empty.
    try {
      const out = await this.ensureRepo().raw(['rev-parse', '--verify', '--quiet', 'MERGE_HEAD']);
      return out.trim().length > 0;
    } catch {
      return false;
    }
  }

  async concludeMerge(): Promise<void> {
    await this.ensureRepo().raw(['commit', '--no-edit']);
  }

  async getMergeMessage(): Promise<string> {
    if (!this.repoPath) return '';
    try {
      const msg = await fs.readFile(path.join(this.repoPath, '.git', 'MERGE_MSG'), 'utf-8');
      return msg.split('\n').find(l => l.trim() && !l.startsWith('#')) ?? '';
    } catch {
      return '';
    }
  }

  async rebase(branch: string): Promise<void> {
    await this.ensureRepo().rebase([branch]);
  }

  async deleteBranch(branch: string, force = false): Promise<void> {
    // Safe delete by default — Git refuses to drop a branch that isn't fully
    // merged unless `force` is explicitly requested by the caller.
    await this.ensureRepo().deleteLocalBranch(branch, force);
  }

  async deleteRemoteBranch(remote: string, branch: string): Promise<void> {
    await this.ensureRepo().push([remote, '--delete', branch]);
  }

  private async hasParent(hash: string): Promise<boolean> {
    try {
      await this.ensureRepo().raw(['rev-parse', '--verify', `${hash}^`]);
      return true;
    } catch {
      return false;
    }
  }

  async getCommitDiff(hash: string): Promise<{ path: string; status: string }[]> {
    const range = (await this.hasParent(hash))
      ? [`${hash}^`, hash]
      : ['4b825dc642cb6eb9a060e54bf8d69288fbee4904', hash];
    const diff = await this.ensureRepo().diffSummary(range);
    return diff.files.map((f) => ({
      path: f.file,
      status: (f as any).status || 'M',
    }));
  }

  async getFileDiff(hash: string, filePath: string): Promise<string> {
    const range = (await this.hasParent(hash))
      ? [`${hash}^`, hash]
      : ['4b825dc642cb6eb9a060e54bf8d69288fbee4904', hash];
    return this.ensureRepo().diff([...range, '--', filePath]);
  }

  async getWorkingDiff(filePath: string): Promise<string> {
    const git = this.ensureRepo();
    const status = await git.status();
    if (status.not_added.includes(filePath)) {
      return this.synthesizeUntrackedDiff(filePath);
    }
    return git.diff(['--', filePath]);
  }

  private async synthesizeUntrackedDiff(filePath: string): Promise<string> {
    try {
      const content = await this.readFile(filePath);
      if (content.includes('\0')) {
        return [
          `diff --git a/${filePath} b/${filePath}`,
          `new file mode 100644`,
          `Binary files /dev/null and b/${filePath} differ`,
        ].join('\n');
      }
      const hasTrailingNewline = content.endsWith('\n');
      const all = content.split('\n');
      const lines = hasTrailingNewline ? all.slice(0, -1) : all;
      const lineCount = lines.length;
      if (lineCount === 0) {
        return [
          `diff --git a/${filePath} b/${filePath}`,
          `new file mode 100644`,
          `--- /dev/null`,
          `+++ b/${filePath}`,
        ].join('\n');
      }
      const header = [
        `diff --git a/${filePath} b/${filePath}`,
        `new file mode 100644`,
        `index 0000000..0000000`,
        `--- /dev/null`,
        `+++ b/${filePath}`,
        `@@ -0,0 +1,${lineCount} @@`,
      ].join('\n');
      const body = lines.map(l => `+${l}`).join('\n');
      return `${header}\n${body}`;
    } catch {
      return '';
    }
  }

  async getStagedDiff(filePath: string): Promise<string> {
    return this.ensureRepo().diff(['--cached', '--', filePath]);
  }

  async getAheadBehind(): Promise<AheadBehind> {
    const status = await this.ensureRepo().status();
    return { ahead: status.ahead, behind: status.behind };
  }

  async getMergeConflicts(): Promise<string[]> {
    const status = await this.ensureRepo().status();
    return status.conflicted;
  }

  async abortMerge(): Promise<void> {
    await this.ensureRepo().merge(['--abort']);
  }

  async markResolved(filePath: string): Promise<void> {
    await this.ensureRepo().add([filePath]);
  }

  async getStashList(): Promise<StashEntry[]> {
    const result = await this.ensureRepo().raw([
      'stash', 'list', '--format=%gd|||%s|||%ai',
    ]);
    if (!result.trim()) return [];
    return result.trim().split('\n').map(line => {
      const [ref, message, date] = line.split('|||');
      const index = parseInt(ref.match(/\{(\d+)\}/)?.[1] ?? '0', 10);
      const wipMatch = message.match(/^WIP on ([^:]+):/);
      const branch = wipMatch ? wipMatch[1] : null;
      return { index, message, branch, date: (date ?? '').trim() };
    });
  }

  async stashSave(message?: string, staged = false): Promise<void> {
    const args = ['stash', 'push'];
    // `--staged` stashes only the index (Git 2.35+). Used by the manual stash
    // UI; the checkout-conflict flows leave it false to stash all tracked work.
    if (staged) args.push('--staged');
    if (message?.trim()) args.push('-m', message.trim());
    await this.ensureRepo().raw(args);
  }

  // SHA of the current top stash (refs/stash), or null when the stash stack is
  // empty. Lets callers detect whether a `stashSave` actually created a stash
  // before popping by index.
  async getStashTop(): Promise<string | null> {
    try {
      const out = await this.ensureRepo().raw(['rev-parse', '-q', '--verify', 'refs/stash']);
      const sha = out.trim();
      return sha.length > 0 ? sha : null;
    } catch {
      return null;
    }
  }

  async stashApply(index: number): Promise<void> {
    await this.ensureRepo().raw(['stash', 'apply', `stash@{${index}}`]);
  }

  async stashPop(index: number): Promise<void> {
    await this.ensureRepo().raw(['stash', 'pop', `stash@{${index}}`]);
  }

  async stashDrop(index: number): Promise<void> {
    await this.ensureRepo().raw(['stash', 'drop', `stash@{${index}}`]);
  }

  async getStashDiff(index: number): Promise<string> {
    return await this.ensureRepo().raw([
      'stash', 'show', '-p', '--unified=3', `stash@{${index}}`,
    ]);
  }

  async readFile(filePath: string): Promise<string> {
    const abs = this.resolveRepoPath(filePath);
    return fs.readFile(abs, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const abs = this.resolveRepoPath(filePath);
    await fs.writeFile(abs, content, 'utf-8');
  }

  async getConflictSides(filePath: string): Promise<{ ours: string; theirs: string; base: string }> {
    const git = this.ensureRepo();
    const [ours, theirs, base] = await Promise.all([
      git.show([`:2:${filePath}`]).catch(() => ''),
      git.show([`:3:${filePath}`]).catch(() => ''),
      git.show([`:1:${filePath}`]).catch(() => ''),
    ]);
    return { ours, theirs, base };
  }

  getRepoPath(): string | null {
    return this.repoPath;
  }
}
