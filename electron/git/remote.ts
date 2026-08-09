import { GitContext } from './context';

export async function fetch(ctx: GitContext): Promise<void> {
  await ctx.ensureRepo().fetch();
}

export async function pull(ctx: GitContext): Promise<string> {
  const result = await ctx.ensureRepo().pull();
  const s = result.summary ?? { changes: 0, insertions: 0, deletions: 0 };
  const ch = s.changes ?? 0,
    ins = s.insertions ?? 0,
    del = s.deletions ?? 0;
  if (ch === 0 && ins === 0 && del === 0) return 'Already up to date';
  return `${ch} changes, ${ins} insertions, ${del} deletions`;
}

export async function push(ctx: GitContext): Promise<void> {
  await ctx.ensureRepo().push();
}

// Publish a branch: push and set its upstream (`git push -u <remote> <branch>`)
// so subsequent push/pull have a tracking ref.
export async function pushSetUpstream(
  ctx: GitContext,
  remote: string,
  branch: string,
): Promise<void> {
  await ctx.ensureRepo().push(['-u', remote, branch]);
}
