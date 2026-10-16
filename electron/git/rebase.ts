import simpleGit from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import { GitContext, credentialSafeEnv } from './context';
import { attachOutputLogger } from '../log/git-logger';

export async function rebase(ctx: GitContext, branch: string): Promise<void> {
  await ctx.ensureRepo().rebase([branch]);
}

export async function isRebasing(ctx: GitContext): Promise<boolean> {
  const git = ctx.ensureRepo();
  for (const dir of ['rebase-merge', 'rebase-apply']) {
    try {
      const rel = (await git.raw(['rev-parse', '--git-path', dir])).trim();
      const abs = path.isAbsolute(rel) ? rel : path.resolve(ctx.repoPath!, rel);
      await fs.access(abs);
      return true;
    } catch {}
  }
  return false;
}

export async function abortRebase(ctx: GitContext): Promise<void> {
  await ctx.ensureRepo().rebase(['--abort']);
}

export async function continueRebase(ctx: GitContext): Promise<void> {
  if (!ctx.repoPath) throw new Error('No repository opened');
  // Dedicated instance: core.editor=true accepts the message unchanged, and
  // strict error detection catches git's stdout-only conflict failure.
  const git = attachOutputLogger(
    simpleGit({
      baseDir: ctx.repoPath,
      unsafe: { allowUnsafeAskPass: true, allowUnsafeEditor: true },
      errors(error, result) {
        if (error) return error;
        if (result.exitCode === 0) return undefined;
        return Buffer.concat([...result.stdOut, ...result.stdErr]);
      },
    }).env(credentialSafeEnv()),
  );
  await git.raw(['-c', 'core.editor=true', 'rebase', '--continue']);
}
