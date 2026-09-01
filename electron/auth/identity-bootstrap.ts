import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ProviderAccount } from '../../src/types';

const run = promisify(execFile);

async function readGlobal(key: string): Promise<string> {
  try {
    const { stdout } = await run('git', ['config', '--global', '--get', key]);
    return stdout.trim();
  } catch {
    // git exits non-zero when the key is unset.
    return '';
  }
}

/**
 * Whether git has an author to attribute a commit to at all.
 *
 * Asked per repository rather than globally so a local override counts, and
 * asked as one boolean rather than a resolved identity because the only thing
 * the UI does with the answer is refuse to let a commit fail.
 */
export async function hasIdentity(repoRoot: string): Promise<boolean> {
  try {
    const { stdout } = await run('git', ['-C', repoRoot, 'config', '--get', 'user.email']);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Give git a name and email to commit as, taken from the account that just
 * signed in.
 *
 * Only writes what is missing. Silently replacing an address the user chose —
 * one that routes their commits to the right identity on a work host, say —
 * would be taking a decision that is not ours to take, and it would be
 * invisible until commits started showing up attributed to the wrong person.
 */
export async function ensureGlobalIdentity(account: ProviderAccount): Promise<void> {
  const [name, email] = await Promise.all([readGlobal('user.name'), readGlobal('user.email')]);

  const nextName = account.name || account.login;
  if (!name && nextName) {
    await run('git', ['config', '--global', 'user.name', nextName]);
  }
  if (!email && account.email) {
    await run('git', ['config', '--global', 'user.email', account.email]);
  }
}
