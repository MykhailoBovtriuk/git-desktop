import { GitContext } from './context';

/**
 * The origin URL, or null for a repository with no remote. Needed to tell an
 * SSH remote from an HTTPS one — they fail authentication for entirely
 * different reasons and the advice differs accordingly.
 */
export async function getRemoteUrl(ctx: GitContext): Promise<string | null> {
  const remotes = await ctx.ensureRepo().getRemotes(true);
  const origin = remotes.find(r => r.name === 'origin') ?? remotes[0];
  return origin?.refs?.push || origin?.refs?.fetch || null;
}

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

export async function pushSetUpstream(
  ctx: GitContext,
  remote: string,
  branch: string,
): Promise<void> {
  await ctx.ensureRepo().push(['-u', remote, branch]);
}
