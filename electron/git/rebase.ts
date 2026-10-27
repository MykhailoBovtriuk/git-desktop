import fs from 'fs/promises';
import { GitContext } from './context';

export async function rebase(ctx: GitContext, branch: string): Promise<void> {
  await ctx.ensureRepo().rebase([branch]);
}

export async function isRebasing(ctx: GitContext): Promise<boolean> {
  for (const dir of ['rebase-merge', 'rebase-apply']) {
    try {
      await fs.access(await ctx.gitPath(dir));
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
  const git = ctx.createGit(ctx.repoPath, {
    errors(error, result) {
      if (error) return error;
      if (result.exitCode === 0) return undefined;
      return Buffer.concat([...result.stdOut, ...result.stdErr]);
    },
  });
  await git.raw(['-c', 'core.editor=true', 'rebase', '--continue']);
}
