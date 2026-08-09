import simpleGit from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import { GitContext, credentialSafeEnv } from './context';

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
  // May still fail if conflicts remain — the error propagates to the UI.
  // Two quirks require a dedicated instance here:
  // - core.editor=true: continuing after a conflicted commit wants to open
  //   an editor for the message; a GUI app has none, so accept it unchanged.
  // - strict `errors` detection: git prints "you must edit all merge
  //   conflicts" on stdout and simple-git's default handler treats non-empty
  //   stdout as success, silently swallowing the exit code 1.
  const git = simpleGit({
    baseDir: ctx.repoPath,
    unsafe: { allowUnsafeAskPass: true, allowUnsafeEditor: true },
    errors(error, result) {
      if (error) return error;
      if (result.exitCode === 0) return undefined;
      return Buffer.concat([...result.stdOut, ...result.stdErr]);
    },
  }).env(credentialSafeEnv());
  await git.raw(['-c', 'core.editor=true', 'rebase', '--continue']);
}
