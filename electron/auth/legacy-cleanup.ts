import { gitConfigUnset } from '../git/exec';

/**
 * Keys the removed "git profiles" feature wrote into repositories.
 * `core.sshCommand` matters most: it routes git around the stored token.
 */
const LEGACY_KEYS = ['core.sshCommand', 'gitdesktop.profile'] as const;

export async function stripLegacyProfileKeys(repoRoot: string): Promise<void> {
  for (const key of LEGACY_KEYS) {
    await gitConfigUnset({ kind: 'local', repoRoot }, key).catch(() => {});
  }
}
