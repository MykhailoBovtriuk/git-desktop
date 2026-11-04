import { credentialsOnHost, type StoredCredential } from './token-store';
import { approveCredentials, gitUsernameFor, rejectCredentials } from './git-credentials';

/** The app's own entry in the system store for this login on the host, if any repository has one. */
export async function appCredentialFor(
  host: string,
  username: string,
): Promise<StoredCredential | undefined> {
  return (await credentialsOnHost(host)).find(c => gitUsernameFor(c.account) === username);
}

/**
 * Take a user's token out of the system credential store, unless another
 * signed-in repository still uses that login on the host: then its token is
 * put back in place, since git keeps one entry per host and username.
 */
export async function releaseGitCredential(
  host: string,
  username: string,
): Promise<StoredCredential | undefined> {
  const sharing = await appCredentialFor(host, username);
  if (sharing) await approveCredentials(host, username, sharing.accessToken);
  else await rejectCredentials(host, username);
  return sharing;
}
