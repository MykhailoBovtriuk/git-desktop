import fs from 'fs/promises';
import { GitContext } from './context';

export async function merge(ctx: GitContext, branch: string): Promise<{ conflicts: string[] }> {
  try {
    await ctx.ensureRepo().merge([branch]);
    return { conflicts: [] };
  } catch (err) {
    // Conflicting files come from status: simple-git's error shape is
    // unreliable, especially on a retry mid-conflict.
    const conflicts = await getMergeConflicts(ctx);
    if (conflicts.length) {
      return { conflicts };
    }
    throw err;
  }
}

export async function isMerging(ctx: GitContext): Promise<boolean> {
  return (await ctx.resolveRef('MERGE_HEAD')) !== null;
}

export async function concludeMerge(ctx: GitContext): Promise<void> {
  await ctx.ensureRepo().raw(['commit', '--no-edit']);
}

export async function getMergeMessage(ctx: GitContext): Promise<string> {
  if (!ctx.repoPath) return '';
  try {
    const msg = await fs.readFile(await ctx.gitPath('MERGE_MSG'), 'utf-8');
    return msg.split('\n').find(l => l.trim() && !l.startsWith('#')) ?? '';
  } catch {
    return '';
  }
}

export async function getMergeConflicts(ctx: GitContext): Promise<string[]> {
  const status = await ctx.ensureRepo().status();
  return status.conflicted;
}

export async function abortMerge(ctx: GitContext): Promise<void> {
  await ctx.ensureRepo().merge(['--abort']);
}

export async function markResolved(ctx: GitContext, filePath: string): Promise<void> {
  await ctx.ensureRepo().raw(['add', '--', filePath]);
}
