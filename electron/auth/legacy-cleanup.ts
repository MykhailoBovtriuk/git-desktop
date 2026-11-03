import { gitConfigUnset } from '../git/exec';
import { logEvent } from '../log/git-logger';

/**
 * Keys the removed "git profiles" feature wrote into repositories.
 * `core.sshCommand` matters most: it routes git around the stored token.
 */
const LEGACY_KEYS = ['core.sshCommand', 'gitdesktop.profile'] as const;

export async function stripLegacyProfileKeys(repoRoot: string): Promise<void> {
  const scope = { kind: 'local', repoRoot } as const;
  for (const key of LEGACY_KEYS) {
    try {
      if (!(await gitConfigUnset(scope, key))) continue;
      logEvent({
        op: 'legacy-cleanup',
        repoPath: repoRoot,
        status: 'info',
        detail: `Removed ${key}, left in .git/config by an older version`,
      });
    } catch (err) {
      logEvent({
        op: 'legacy-cleanup',
        repoPath: repoRoot,
        status: 'warning',
        detail: key,
        error: err,
      });
    }
  }
}
