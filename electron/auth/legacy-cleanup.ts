import { gitConfigUnset } from '../git/exec';

/**
 * Keys the removed "git profiles" feature wrote into repositories.
 * `core.sshCommand` matters most: it routes git around the stored token.
 */
const LEGACY_KEYS = ['core.sshCommand', 'gitdesktop.profile'] as const;

/**
 * Remove those keys once on open: only these two, `--local` only; anything the
 * user set stays untouched.
 */
export async function stripLegacyProfileKeys(repoRoot: string): Promise<void> {
  for (const key of LEGACY_KEYS) {
    // Best effort: a repository we cannot write to still opens.
    await gitConfigUnset({ kind: 'local', repoRoot }, key).catch(() => {});
  }
}
