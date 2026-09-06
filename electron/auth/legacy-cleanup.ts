import { execFile } from 'child_process';
import { promisify } from 'util';

const run = promisify(execFile);

/**
 * Keys an earlier build of this app wrote into the user's repositories for the
 * since-removed "git profiles" feature.
 *
 * `core.sshCommand` is the one that matters: it pins git to a particular SSH
 * key, which routes every fetch and push around the token this app now stores
 * and leaves authentication failing for a reason nothing in the UI explains.
 */
const LEGACY_KEYS = ['core.sshCommand', 'gitdesktop.profile'] as const;

/**
 * Remove those keys from a repository, once, on open.
 *
 * This is the only place the app writes to somebody's repository config
 * unasked, so it is deliberately narrow: two named keys, `--local` only, and
 * only keys this app itself wrote. Anything the user set stays untouched.
 */
export async function stripLegacyProfileKeys(repoRoot: string): Promise<void> {
  for (const key of LEGACY_KEYS) {
    await run('git', ['-C', repoRoot, 'config', '--local', '--unset', key]).catch(() => {
      // Exit code 5 means "was not set" — the desired end state either way.
    });
  }
}
