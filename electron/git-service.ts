import simpleGit, { SimpleGit } from 'simple-git';
import type { Commit, Branch, GitStatus, FileStatus, AheadBehind } from '../src/types';

export class GitService {
  private git: SimpleGit | null = null;
  private repoPath: string | null = null;

  async openRepo(dirPath: string): Promise<void> {
    this.repoPath = dirPath;
    this.git = simpleGit(dirPath);
  }

  private ensureRepo(): SimpleGit {
    if (!this.git) throw new Error('No repository opened');
    return this.git;
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

  async getStatus(): Promise<GitStatus> {
    const git = this.ensureRepo();
    const status = await git.status();

    const staged: FileStatus[] = [];
    const unstaged: FileStatus[] = [];

    for (const file of status.files) {
      const stagedCode = file.index;
      const unstagedCode = file.working_dir;

      if (stagedCode && stagedCode !== ' ' && stagedCode !== '?') {
        staged.push({ path: file.path, status: this.mapStatus(stagedCode), staged: true });
      }

      if (unstagedCode && unstagedCode !== ' ') {
        unstaged.push({
          path: file.path,
          status: unstagedCode === '?' ? '?' : this.mapStatus(unstagedCode),
          staged: false,
        });
      }
    }

    return { staged, unstaged };
  }

  private mapStatus(code: string): FileStatus['status'] {
    const map: Record<string, FileStatus['status']> = {
      A: 'A', M: 'M', D: 'D', R: 'R', C: 'C', '?': '?',
    };
    return map[code] ?? 'M';
  }

  async stageFiles(paths: string[]): Promise<void> {
    await this.ensureRepo().add(paths);
  }

  async unstageFiles(paths: string[]): Promise<void> {
    await this.ensureRepo().reset(['HEAD', '--', ...paths]);
  }

  async discardChanges(paths: string[]): Promise<void> {
    await this.ensureRepo().checkout(['--', ...paths]);
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
    return `${result.summary.changes} changes, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions`;
  }

  async push(): Promise<void> {
    await this.ensureRepo().push();
  }

  async checkout(branch: string): Promise<void> {
    await this.ensureRepo().checkout(branch);
  }

  async merge(branch: string): Promise<{ success: boolean; conflicts: string[] }> {
    try {
      await this.ensureRepo().merge([branch]);
      return { success: true, conflicts: [] };
    } catch (err: any) {
      if (err.git?.conflicts?.length) {
        return { success: false, conflicts: err.git.conflicts };
      }
      throw err;
    }
  }

  async rebase(branch: string): Promise<void> {
    await this.ensureRepo().rebase([branch]);
  }

  async deleteBranch(branch: string): Promise<void> {
    await this.ensureRepo().deleteLocalBranch(branch, true);
  }

  async getCommitDiff(hash: string): Promise<{ path: string; status: string }[]> {
    const diff = await this.ensureRepo().diffSummary([`${hash}^`, hash]);
    return diff.files.map((f) => ({
      path: f.file,
      status: (f as any).status || 'M',
    }));
  }

  async getFileDiff(hash: string, filePath: string): Promise<string> {
    return this.ensureRepo().diff([`${hash}^`, hash, '--', filePath]);
  }

  async getWorkingDiff(filePath: string): Promise<string> {
    return this.ensureRepo().diff(['--', filePath]);
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

  async stash(): Promise<void> {
    await this.ensureRepo().stash();
  }

  async stashPop(): Promise<void> {
    await this.ensureRepo().stash(['pop']);
  }

  getRepoPath(): string | null {
    return this.repoPath;
  }
}
