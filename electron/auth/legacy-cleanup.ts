import fs from 'fs/promises';
import { gitConfigGet, gitConfigUnset } from '../git/exec';
import { logEvent } from '../log/git-logger';
import { takeUnsupportedCredentials } from './token-store';
import { gitUsernameFor, unbindRepoUsername } from './git-credentials';
import { releaseGitCredential } from './release-git-credential';

/**
 * Keys the removed "git profiles" feature wrote into repositories.
 * `core.sshCommand` goes only when it is exactly what that feature wrote
 * (`ssh -i "<key>" -o IdentitiesOnly=yes`): any other value is the user's own.
 */
const LEGACY_KEYS: { key: string; written?: RegExp }[] = [
  { key: 'core.sshCommand', written: /^ssh -i "[^"]+" -o IdentitiesOnly=yes$/ },
  { key: 'gitdesktop.profile' },
];

export async function stripLegacyProfileKeys(repoRoot: string): Promise<void> {
  const scope = { kind: 'local', repoRoot } as const;
  for (const { key, written } of LEGACY_KEYS) {
    try {
      if (written && !written.test(await gitConfigGet(scope, key))) continue;
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

/**
 * Sign-ins left by providers older versions offered (Bitbucket, Gitea, a bare
 * token for any server). None of them had a revoke endpoint, so the token
 * stays valid on the server: the log entry says so.
 */
export async function dropUnsupportedAccounts(): Promise<void> {
  let dropped;
  try {
    dropped = await takeUnsupportedCredentials();
  } catch (err) {
    logEvent({ op: 'account-drop', repoPath: null, status: 'warning', error: err });
    return;
  }
  for (const { account, host, repoPath } of dropped) {
    const detail = `${account.providerId} · ${host} · ${repoPath}`;
    try {
      await releaseGitCredential(host, gitUsernameFor(account));
      if (await exists(repoPath)) await unbindRepoUsername(repoPath, host);
      logEvent({
        op: 'account-drop',
        repoPath: null,
        status: 'warning',
        detail,
        error:
          `Signed out @${account.login} on ${host}: Git Desktop no longer supports this service. ` +
          'The token was not revoked: delete it on the server if you no longer need it',
      });
    } catch (err) {
      logEvent({ op: 'account-drop', repoPath: null, status: 'warning', detail, error: err });
    }
  }
}

async function exists(dir: string): Promise<boolean> {
  return fs.access(dir).then(
    () => true,
    () => false,
  );
}
