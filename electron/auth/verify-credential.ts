/**
 * Prove a username and token actually authenticate, before anything stores
 * them.
 *
 * The generic token path has no API to ask — it exists precisely for servers
 * nobody registered an OAuth app for — so the check goes to the one endpoint
 * every git server over https must serve: the Smart HTTP advertisement that
 * `git fetch` and `git push` themselves begin with.
 *
 * Running `git ls-remote` would look more natural and prove nothing: against a
 * public repository the server never issues a challenge, so git never sends the
 * credential and the command succeeds with any rubbish at all — measured, not
 * assumed. Sending the Authorization header unasked is what forces the server
 * to have an opinion; GitHub, GitLab and Forgejo all answer 401 to a bad one
 * even on a repository they would serve anonymously.
 */

const USER_AGENT = 'git-desktop';

/**
 * The advertisement URL for a remote.
 *
 * Any credentials already embedded in the remote URL are dropped: they would be
 * sent in place of the ones being checked, and the answer would be about the
 * wrong identity.
 */
export function probeUrlFor(remoteUrl: string): string {
  const url = new URL(remoteUrl);
  url.username = '';
  url.password = '';
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/info/refs`;
  url.search = '?service=git-upload-pack';
  url.hash = '';
  return url.toString();
}

/**
 * Resolves when the credential works against `remoteUrl`, rejects with a
 * message the sign-in dialog can show otherwise.
 */
export async function verifyAgainstRemote(
  remoteUrl: string,
  username: string,
  token: string,
): Promise<void> {
  const basic = Buffer.from(`${username}:${token}`).toString('base64');
  let res: Response;
  try {
    res = await fetch(probeUrlFor(remoteUrl), {
      headers: {
        Authorization: `Basic ${basic}`,
        'User-Agent': USER_AGENT,
        // Asking for the smart protocol; a server that only speaks the dumb one
        // answers anyway, and the status is all this reads.
        Accept: 'application/x-git-upload-pack-advertisement',
      },
    });
  } catch {
    // DNS, TLS, no route. Not a verdict on the token, and saying so matters:
    // "wrong token" sends the user to reissue a token that was fine.
    throw new Error('Could not reach the server to check this token');
  }

  if (res.ok) return;
  if (res.status === 401 || res.status === 403) {
    throw new Error('The server rejected this username and token');
  }
  if (res.status === 404) {
    // GitHub answers 404 rather than 403 for a repository the credential is
    // not allowed to see, so this is "the token is not enough", not "no repo".
    throw new Error('This token cannot reach that repository');
  }
  throw new Error(`The server answered ${res.status} when checking this token`);
}
