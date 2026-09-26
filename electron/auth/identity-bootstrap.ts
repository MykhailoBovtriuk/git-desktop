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
 * Whether git has an author to commit as. Asked per repository so a local
 * override counts.
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
 * Give git a name and email from the account that just signed in. Only writes
 * what is missing, never replaces the user's choice.
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
