import { describe, it, expect, beforeEach, vi } from 'vitest';
import { probeUrlFor, verifyAgainstRemote } from '../../electron/auth/verify-credential';

interface Call {
  url: string;
  headers: Record<string, string>;
}

const calls: Call[] = [];
/** What the stand-in server does next: a status, or a transport failure. */
let respond: () => Promise<Response> = () => Promise.resolve(new Response('', { status: 200 }));

vi.stubGlobal('fetch', (url: string, init: { headers: Record<string, string> }) => {
  calls.push({ url, headers: init.headers });
  return respond();
});

const answers = (status: number) => {
  respond = () => Promise.resolve(new Response(status === 200 ? 'refs' : '', { status }));
};

beforeEach(() => {
  calls.length = 0;
  answers(200);
});

describe('probeUrlFor', () => {
  it('points at the advertisement git itself starts a fetch with', () => {
    expect(probeUrlFor('https://github.com/owner/repo.git')).toBe(
      'https://github.com/owner/repo.git/info/refs?service=git-upload-pack',
    );
    expect(probeUrlFor('https://git.example.com/owner/repo/')).toBe(
      'https://git.example.com/owner/repo/info/refs?service=git-upload-pack',
    );
  });

  // Credentials already in the remote URL would be sent instead of the ones
  // under test, and the answer would be about the wrong identity.
  it('drops credentials embedded in the remote', () => {
    expect(probeUrlFor('https://someone:secret@git.example.com/a/b.git')).toBe(
      'https://git.example.com/a/b.git/info/refs?service=git-upload-pack',
    );
  });
});

describe('verifyAgainstRemote', () => {
  it('passes when the server accepts the credential', async () => {
    answers(200);
    await verifyAgainstRemote('https://git.example.com/a/b.git', 'alice', 'tok');
  });

  // The whole point: a public repository issues no challenge, so git would
  // never send the credential and any rubbish would "work". The header goes
  // out unasked so the server has to have an opinion.
  it('sends the credential unasked rather than waiting to be challenged', async () => {
    answers(200);
    await verifyAgainstRemote('https://git.example.com/a/b.git', 'alice', 'tok');

    expect(calls[calls.length - 1]?.headers.Authorization).toBe(
      `Basic ${Buffer.from('alice:tok').toString('base64')}`,
    );
  });

  it('reports a rejected credential as such', async () => {
    for (const status of [401, 403]) {
      answers(status);
      await expect(
        verifyAgainstRemote('https://git.example.com/a/b.git', '1-1', '1-1'),
      ).rejects.toThrow(/rejected/i);
    }
  });

  // GitHub answers 404 for a repository the credential may not see, so this is
  // "the token is not enough" rather than "no such repository".
  it('reports a token that cannot reach the repository', async () => {
    answers(404);
    await expect(
      verifyAgainstRemote('https://git.example.com/a/b.git', 'alice', 'tok'),
    ).rejects.toThrow(/cannot reach that repository/i);
  });

  // Saying "wrong token" here would send the user off to reissue a token that
  // was never the problem.
  it('tells an unreachable server apart from a bad credential', async () => {
    respond = () => Promise.reject(new TypeError('fetch failed'));
    await expect(
      verifyAgainstRemote('https://git.example.com/a/b.git', 'alice', 'tok'),
    ).rejects.toThrow(/reach/i);
  });

  it('does not treat some other server error as a verdict on the token', async () => {
    answers(500);
    await expect(
      verifyAgainstRemote('https://git.example.com/a/b.git', 'alice', 'tok'),
    ).rejects.toThrow(/answered 500/);
  });
});
