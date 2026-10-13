import type { GitIdentities, GitIdentity, ProviderAccount } from '../../src/types';
import { gitConfigGet, gitConfigSet, gitConfigUnset, type ConfigScope } from '../git/exec';

const GLOBAL: ConfigScope = { kind: 'global' };

async function readIdentity(scope: ConfigScope): Promise<GitIdentity> {
  const [name, email] = await Promise.all([
    gitConfigGet(scope, 'user.name'),
    gitConfigGet(scope, 'user.email'),
  ]);
  return { name, email };
}

/** The global author, and this repository's override when one is open. */
export async function getIdentity(repoRoot: string | null): Promise<GitIdentities> {
  const global = await readIdentity(GLOBAL);
  if (!repoRoot) return { global, local: null };
  return { global, local: await readIdentity({ kind: 'local', repoRoot }) };
}

/**
 * Writes the author for one scope. An empty value unsets the key, which for a
 * repository means falling back to the global author.
 */
export async function setIdentity(
  scope: 'global' | 'local',
  repoRoot: string | null,
  identity: GitIdentity,
): Promise<void> {
  if (scope === 'local' && !repoRoot) throw new Error('No repository opened');
  const target: ConfigScope = scope === 'global' ? GLOBAL : { kind: 'local', repoRoot: repoRoot! };
  for (const [key, value] of [
    ['user.name', identity.name.trim()],
    ['user.email', identity.email.trim()],
  ] as const) {
    if (value) await gitConfigSet(target, key, value);
    else await gitConfigUnset(target, key);
  }
}

/**
 * Whether git has an author to commit as. Asked per repository so a local
 * override counts.
 */
export async function hasIdentity(repoRoot: string): Promise<boolean> {
  return (await gitConfigGet({ kind: 'effective', repoRoot }, 'user.email')).length > 0;
}

/**
 * Give git a name and email from the account that just signed in. Only writes
 * what is missing, never replaces the user's choice.
 */
export async function ensureGlobalIdentity(account: ProviderAccount): Promise<void> {
  const { name, email } = await readIdentity(GLOBAL);
  const nextName = account.name || account.login;
  if (!name && nextName) await gitConfigSet(GLOBAL, 'user.name', nextName);
  if (!email && account.email) await gitConfigSet(GLOBAL, 'user.email', account.email);
}
