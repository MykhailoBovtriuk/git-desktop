import { GitContext } from './context';
import { accountForHost, getFreshToken } from '../auth/token-store';
import { resolveRemoteHost } from '../auth/remote-host';

/**
 * The origin URL, or null without a remote. SSH and HTTPS fail authentication
 * for different reasons.
 */
export async function getRemoteUrl(ctx: GitContext): Promise<string | null> {
  const remotes = await ctx.ensureRepo().getRemotes(true);
  const origin = remotes.find(r => r.name === 'origin') ?? remotes[0];
  return origin?.refs?.push || origin?.refs?.fetch || null;
}

/**
 * Refresh a short-lived token before git reads it; `getFreshToken` rewrites the
 * system credential on renewal.
 */
async function refreshCredentialIfNeeded(ctx: GitContext): Promise<void> {
  try {
    const host = await resolveRemoteHost(await getRemoteUrl(ctx));
    if (!host) return;
    const account = await accountForHost(host);
    if (account) await getFreshToken(account.id);
  } catch {
    // Refreshing is an optimisation over letting git fail; never a reason to
    // block the operation the user asked for.
  }
}

export async function fetch(ctx: GitContext): Promise<void> {
  await refreshCredentialIfNeeded(ctx);
  await ctx.ensureRepo().fetch();
}

export async function pull(ctx: GitContext): Promise<string> {
  await refreshCredentialIfNeeded(ctx);
  const result = await ctx.ensureRepo().pull();
  const s = result.summary ?? { changes: 0, insertions: 0, deletions: 0 };
  const ch = s.changes ?? 0,
    ins = s.insertions ?? 0,
    del = s.deletions ?? 0;
  if (ch === 0 && ins === 0 && del === 0) return 'Already up to date';
  return `${ch} changes, ${ins} insertions, ${del} deletions`;
}

export async function push(ctx: GitContext): Promise<void> {
  await refreshCredentialIfNeeded(ctx);
  await ctx.ensureRepo().push();
}

export async function pushSetUpstream(
  ctx: GitContext,
  remote: string,
  branch: string,
): Promise<void> {
  await refreshCredentialIfNeeded(ctx);
  await ctx.ensureRepo().push(['-u', remote, branch]);
}
