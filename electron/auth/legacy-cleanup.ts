import { execFile } from 'child_process';
import { promisify } from 'util';

const run = promisify(execFile);

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
    await run('git', ['-C', repoRoot, 'config', '--local', '--unset', key]).catch(() => {
      // Exit code 5 means "was not set" — the desired end state either way.
    });
  }
}
