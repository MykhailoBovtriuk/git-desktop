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

export async function getIdentity(repoRoot: string | null): Promise<GitIdentities> {
  const global = await readIdentity(GLOBAL);
  if (!repoRoot) return { global, local: null };
  return { global, local: await readIdentity({ kind: 'local', repoRoot }) };
}

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

export async function hasIdentity(repoRoot: string): Promise<boolean> {
  return (await gitConfigGet({ kind: 'effective', repoRoot }, 'user.email')).length > 0;
}

export async function ensureGlobalIdentity(account: ProviderAccount): Promise<void> {
  const { name, email } = await readIdentity(GLOBAL);
  const nextName = account.name || account.login;
  if (!name && nextName) await gitConfigSet(GLOBAL, 'user.name', nextName);
  if (!email && account.email) await gitConfigSet(GLOBAL, 'user.email', account.email);
}
