import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';

// The empty-tree object hash: stands in as the "before" side when diffing a
// root commit that has no parent.
export const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

// A GUI app has no TTY: without these, any fetch/pull/push that needs
// credentials hangs forever on an invisible prompt. GIT_TERMINAL_PROMPT=0
// forbids terminal prompts and GIT_ASKPASS=echo makes the askpass round-trip
// return immediately (echo prints the prompt, not a password), so the
// operation fails fast with an auth error instead of hanging.
export function credentialSafeEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: 'echo',
  };
}

// Shared state and helpers for every git domain module: owns the active
// simple-git instance, the repo root, and the path-safety / HEAD checks the
// domains depend on.
export class GitContext {
  git: SimpleGit | null = null;
  repoPath: string | null = null;

  createGit(dir: string): SimpleGit {
    // simple-git's .env(object) REPLACES the child env, so the merge over
    // process.env in credentialSafeEnv() is what keeps PATH/HOME intact.
    // The `unsafe` opt-ins exist to guard against attacker-controlled values;
    // ours are hardcoded ('echo' for askpass, 'true' as rebase editor) and the
    // inherited env may legitimately carry GIT_EDITOR from the user's shell.
    return simpleGit({
      baseDir: dir,
      unsafe: { allowUnsafeAskPass: true, allowUnsafeEditor: true },
    }).env(credentialSafeEnv());
  }

  async openRepo(dirPath: string): Promise<string> {
    const git = this.createGit(dirPath);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new Error('Selected folder is not a Git repository');
    }
    // Normalize to the repository root so file paths (status/diff are relative
    // to the root) and recent-repo entries are canonical, even when the user
    // picked a subfolder inside the repo.
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
    // realpath the root too: on macOS os.tmpdir() itself sits behind a symlink.
    const repoRoot = await fs.realpath(path.resolve(this.repoPath));
    const abs = path.resolve(repoRoot, filePath);
    this.assertInsideWorkTree(abs, repoRoot);
    // Lexical checks pass for a symlink that points outside the repo; resolve
    // the target (or, for a not-yet-existing file, its parent directory) and
    // re-check the real location.
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

  // Whether HEAD points at a real commit (false on the unborn HEAD of a
  // freshly `git init`ed repository).
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
