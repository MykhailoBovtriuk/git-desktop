import type { StashEntry } from '../../src/types';
import { GitContext } from './context';

export async function getStashList(ctx: GitContext): Promise<StashEntry[]> {
  const result = await ctx.ensureRepo().raw(['stash', 'list', '--format=%gd|||%s|||%ai']);
  if (!result.trim()) return [];
  return result
    .trim()
    .split('\n')
    .map(line => {
      const [ref, message, date] = line.split('|||');
      const index = parseInt(ref.match(/\{(\d+)\}/)?.[1] ?? '0', 10);
      const wipMatch = message.match(/^WIP on ([^:]+):/);
      const branch = wipMatch ? wipMatch[1] : null;
      return { index, message, branch, date: (date ?? '').trim() };
    });
}

export async function stashSave(ctx: GitContext, message?: string, staged = false): Promise<void> {
  const args = ['stash', 'push'];
  // `--staged` stashes only the index (Git 2.35+). Used by the manual stash
  // UI; the checkout-conflict flows leave it false to stash all tracked work.
  if (staged) args.push('--staged');
  if (message?.trim()) args.push('-m', message.trim());
  await ctx.ensureRepo().raw(args);
}

// SHA of the current top stash (refs/stash), or null when the stash stack is
// empty. Lets callers detect whether a `stashSave` actually created a stash
// before popping by index.
export async function getStashTop(ctx: GitContext): Promise<string | null> {
  try {
    const out = await ctx.ensureRepo().raw(['rev-parse', '-q', '--verify', 'refs/stash']);
    const sha = out.trim();
    return sha.length > 0 ? sha : null;
  } catch {
    return null;
  }
}

export async function stashApply(ctx: GitContext, index: number): Promise<void> {
  await ctx.ensureRepo().raw(['stash', 'apply', `stash@{${index}}`]);
}

export async function stashPop(ctx: GitContext, index: number): Promise<void> {
  await ctx.ensureRepo().raw(['stash', 'pop', `stash@{${index}}`]);
}

export async function stashDrop(ctx: GitContext, index: number): Promise<void> {
  await ctx.ensureRepo().raw(['stash', 'drop', `stash@{${index}}`]);
}

export async function getStashDiff(ctx: GitContext, index: number): Promise<string> {
  return ctx.ensureRepo().raw(['stash', 'show', '-p', '--unified=3', `stash@{${index}}`]);
}
