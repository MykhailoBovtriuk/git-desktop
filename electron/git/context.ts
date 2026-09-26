import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';

export const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

// A GUI app has no TTY: GIT_TERMINAL_PROMPT=0 and GIT_ASKPASS=echo make auth
// failures fail fast instead of hanging. Keep GIT_TERMINAL_PROMPT=0 even with
// an in-app prompt.
export function credentialSafeEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: 'echo',
  };
}

export class GitContext {
  git: SimpleGit | null = null;
  repoPath: string | null = null;

  createGit(dir: string): SimpleGit {
    // simple-git's .env() replaces the child env, hence the merge over
    // process.env. Our unsafe values are hardcoded; allowUnsafeSshCommand is
    // only for removing core.sshCommand.
    return simpleGit({
      baseDir: dir,
      unsafe: {
        allowUnsafeAskPass: true,
        allowUnsafeEditor: true,
        allowUnsafeSshCommand: true,
      },
    }).env(credentialSafeEnv());
  }

  async openRepo(dirPath: string): Promise<string> {
    const git = this.createGit(dirPath);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new Error('Selected folder is not a Git repository');
    }
    const root = (await git.revparse(['--show-toplevel'])).trim();
    this.repoPath = root;
    this.git = this.createGit(root);
    return root;
  }

  ensureRepo(): SimpleGit {
    if (!this.git) throw new Error('No repository opened');
    return this.git;
  }

  async resolveRepoPath(filePath: string): Promise<string> {
    if (!this.repoPath) throw new Error('No repository opened');
    if (typeof filePath !== 'string' || filePath.length === 0) {
      throw new Error('Invalid file path');
    }
    if (path.isAbsolute(filePath)) {
      throw new Error('Path is outside repository');
    }
    const repoRoot = await fs.realpath(path.resolve(this.repoPath));
    const abs = path.resolve(repoRoot, filePath);
    this.assertInsideWorkTree(abs, repoRoot);
    const real = await fs.realpath(abs).catch(async () => {
      const parent = await fs.realpath(path.dirname(abs)).catch(() => null);
      return parent === null ? null : path.join(parent, path.basename(abs));
    });
    if (real !== null) this.assertInsideWorkTree(real, repoRoot);
    return abs;
  }

  private assertInsideWorkTree(abs: string, repoRoot: string): void {
    if (abs !== repoRoot && !abs.startsWith(repoRoot + path.sep)) {
      throw new Error('Path is outside repository');
    }
    // Writes into .git (hooks, config) are code execution on the next git
    // command; reads may leak credentials from .git/config.
    const firstSegment = path.relative(repoRoot, abs).split(path.sep)[0];
    if (firstSegment.toLowerCase() === '.git') {
      throw new Error('Path is outside repository');
    }
  }

  async hasHead(): Promise<boolean> {
    try {
      const out = await this.ensureRepo().raw(['rev-parse', '--verify', '--quiet', 'HEAD']);
      return out.trim().length > 0;
    } catch {
      return false;
    }
  }

  async hasParent(hash: string): Promise<boolean> {
    try {
      await this.ensureRepo().raw(['rev-parse', '--verify', `${hash}^`]);
      return true;
    } catch {
      return false;
    }
  }

  getRepoPath(): string | null {
    return this.repoPath;
  }
}
