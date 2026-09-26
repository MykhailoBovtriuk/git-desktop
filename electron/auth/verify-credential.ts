/**
 * Prove a credential via the Smart HTTP advertisement, sending Authorization
 * unasked: a public repo never challenges, so `ls-remote` accepts anything.
 */

const USER_AGENT = 'git-desktop';

/**
 * The advertisement URL for a remote, with any embedded credentials dropped so
 * they do not replace the ones being checked.
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
