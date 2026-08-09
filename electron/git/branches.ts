import type { Branch } from '../../src/types';
import { GitContext } from './context';

export async function getBranches(ctx: GitContext): Promise<Branch[]> {
  const git = ctx.ensureRepo();
  const summary = await git.branch(['-a']);

  // Map each local branch to its upstream (tracking) ref, if any. simple-git's
  // branch summary doesn't expose upstream, so read it via for-each-ref.
  const tracking = new Map<string, string>();
  try {
    const raw = await git.raw([
      'for-each-ref',
      '--format=%(refname:short)%00%(upstream:short)',
      'refs/heads',
    ]);
    for (const line of raw.split('\n').filter(Boolean)) {
      const [name, upstream] = line.split('\x00');
      if (upstream) tracking.set(name, upstream);
    }
  } catch {
    // Older git or unusual state — leave tracking empty rather than fail.
  }

  const branches: Branch[] = [];
  for (const [name, info] of Object.entries(summary.branches)) {
    const isRemote = name.startsWith('remotes/');
    const cleanName = isRemote ? name.replace('remotes/', '') : name;
    branches.push({
      name: cleanName,
      current: info.current,
      remote: isRemote,
      tracking: isRemote ? undefined : tracking.get(cleanName),
    });
  }

  return branches;
}

export async function checkout(ctx: GitContext, branch: string): Promise<void> {
  await ctx.ensureRepo().checkout(branch);
}

export async function checkoutForce(ctx: GitContext, branch: string): Promise<void> {
  await ctx.ensureRepo().checkout(['-f', branch]);
}

export async function deleteBranch(ctx: GitContext, branch: string, force = false): Promise<void> {
  // Safe delete by default — Git refuses to drop a branch that isn't fully
  // merged unless `force` is explicitly requested by the caller.
  await ctx.ensureRepo().deleteLocalBranch(branch, force);
}

export async function deleteRemoteBranch(
  ctx: GitContext,
  remote: string,
  branch: string,
): Promise<void> {
  await ctx.ensureRepo().push([remote, '--delete', branch]);
}
