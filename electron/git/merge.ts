import fs from 'fs/promises';
import path from 'path';
import { GitContext } from './context';

export async function merge(
  ctx: GitContext,
  branch: string,
): Promise<{ success: boolean; conflicts: string[] }> {
  try {
    await ctx.ensureRepo().merge([branch]);
    return { success: true, conflicts: [] };
  } catch (err) {
    // Conflicting files come from status: simple-git's error shape is
    // unreliable, especially on a retry mid-conflict.
    const conflicts = (await ctx.ensureRepo().status()).conflicted;
    if (conflicts.length) {
      return { success: false, conflicts };
    }
    throw err;
  }
}

export async function isMerging(ctx: GitContext): Promise<boolean> {
  try {
    const out = await ctx.ensureRepo().raw(['rev-parse', '--verify', '--quiet', 'MERGE_HEAD']);
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

export async function concludeMerge(ctx: GitContext): Promise<void> {
  await ctx.ensureRepo().raw(['commit', '--no-edit']);
}

export async function getMergeMessage(ctx: GitContext): Promise<string> {
  if (!ctx.repoPath) return '';
  try {
    const msg = await fs.readFile(path.join(ctx.repoPath, '.git', 'MERGE_MSG'), 'utf-8');
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

export async function getConflictSides(
  ctx: GitContext,
  filePath: string,
): Promise<{ ours: string; theirs: string; base: string }> {
  const git = ctx.ensureRepo();
  const [ours, theirs, base] = await Promise.all([
    git.show([`:2:${filePath}`]).catch(() => ''),
    git.show([`:3:${filePath}`]).catch(() => ''),
    git.show([`:1:${filePath}`]).catch(() => ''),
  ]);
  return { ours, theirs, base };
}
