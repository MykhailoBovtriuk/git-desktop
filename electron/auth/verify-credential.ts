/**
 * Prove a credential via the Smart HTTP advertisement, sending Authorization
 * unasked: a public repo never challenges, so `ls-remote` accepts anything.
 */

const USER_AGENT = 'git-desktop';

export function probeUrlFor(remoteUrl: string): string {
  const url = new URL(remoteUrl);
  url.username = '';
  url.password = '';
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/info/refs`;
  url.search = '?service=git-upload-pack';
  url.hash = '';
  return url.toString();
}

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
        Accept: 'application/x-git-upload-pack-advertisement',
      },
    });
  } catch {
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
