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

/**
 * `includeUntracked` matters wherever "set everything aside" has to mean
 * everything: `getStatus` counts an untracked file as a change, so without `-u`
 * a stash that looks complete in the UI leaves new files sitting in the working
 * tree. It is exclusive with `staged` — git rejects `--staged -u`, and the two
 * ask for opposite things anyway.
 */
export async function stashSave(
  ctx: GitContext,
  message?: string,
  staged = false,
  includeUntracked = false,
): Promise<void> {
  if (staged && includeUntracked) {
    throw new Error('stashSave: staged and includeUntracked are mutually exclusive');
  }
  const args = ['stash', 'push'];
  if (staged) args.push('--staged');
  if (includeUntracked) args.push('-u');
  if (message?.trim()) args.push('-m', message.trim());
  await ctx.ensureRepo().raw(args);
}

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
