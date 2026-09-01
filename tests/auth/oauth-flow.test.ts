import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { beginSignIn, completeSignIn, resetPendingFlow } from '../../electron/auth/oauth-flow';
import { providerById } from '../../electron/auth/providers/registry';
import { resetKeyCache } from '../../electron/auth/oauth-config';

const github = providerById('github')!;
const gitlab = providerById('gitlab')!;

/** The state parameter the app just put in the authorize URL. */
const stateOf = (url: string) => new URL(url).searchParams.get('state')!;

describe('oauth flow', () => {
  beforeEach(() => {
    resetPendingFlow();
    resetKeyCache();
    process.env.OAUTH_GITHUB_ID = 'gh-id';
    process.env.OAUTH_GITHUB_SECRET = 'gh-secret';
    process.env.OAUTH_GITLAB_ID = 'gl-id';
  });

  afterEach(() => {
    delete process.env.OAUTH_GITHUB_ID;
    delete process.env.OAUTH_GITHUB_SECRET;
    delete process.env.OAUTH_GITLAB_ID;
    resetKeyCache();
    resetPendingFlow();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('builds an authorize URL carrying the client id, scopes and redirect', () => {
    const url = new URL(beginSignIn({ provider: github, host: 'github.com' }));
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('gh-id');
    expect(url.searchParams.get('redirect_uri')).toBe('git-desktop-auth://oauth');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('repo user workflow');
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  // GitHub has no PKCE for desktop clients, so the secret is the only thing
  // binding the exchange to this app. Sending a challenge would be noise.
  it('omits the PKCE challenge for a provider that uses a secret', () => {
    const url = new URL(beginSignIn({ provider: github, host: 'github.com' }));
    expect(url.searchParams.get('code_challenge')).toBeNull();
  });

  it('sends an S256 challenge derived from the verifier for a PKCE provider', async () => {
    const url = new URL(beginSignIn({ provider: gitlab, host: 'gitlab.com' }));
    const challenge = url.searchParams.get('code_challenge');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(challenge).toBeTruthy();

    // The verifier only leaves this module in the token request, so that is
    // where the pairing has to be checked.
    let sentVerifier = '';
    stubFetch(
      body => {
        sentVerifier = new URLSearchParams(body).get('code_verifier') ?? '';
        return { access_token: 'tok' };
      },
      { username: 'u', name: 'U', commit_email: 'u@x' },
    );

    await completeSignIn(`git-desktop-auth://oauth?code=abc&state=${stateOf(url.toString())}`);
    expect(crypto.createHash('sha256').update(sentVerifier).digest('base64url')).toBe(challenge);
  });

  it('refuses a provider whose keys this build lacks', () => {
    delete process.env.OAUTH_GITHUB_ID;
    resetKeyCache();
    expect(() => beginSignIn({ provider: github, host: 'github.com' })).toThrow(
      /No OAuth client id/,
    );
  });

  it('refuses when no sign-in is in progress', async () => {
    await expect(completeSignIn('git-desktop-auth://oauth?code=a&state=b')).rejects.toThrow(
      /No sign-in is in progress/,
    );
  });

  // The whole point of `state`: without this check anyone able to open a
  // git-desktop-auth:// URL could hand us an account and have it stored as the
  // user's own.
  it('rejects a callback whose state does not match', async () => {
    beginSignIn({ provider: github, host: 'github.com' });
    await expect(
      completeSignIn('git-desktop-auth://oauth?code=abc&state=somebody-elses'),
    ).rejects.toThrow(/state did not match/);
  });

  it('spends the state, so a replay of the same callback fails', async () => {
    const url = beginSignIn({ provider: github, host: 'github.com' });
    const callback = `git-desktop-auth://oauth?code=abc&state=${stateOf(url)}`;
    stubFetch(() => ({ access_token: 'tok' }), { login: 'me', id: 1, name: 'Me', email: 'me@x' });

    await completeSignIn(callback);
    await expect(completeSignIn(callback)).rejects.toThrow(/No sign-in is in progress/);
  });

  it('rejects a callback that arrives after the state has expired', async () => {
    vi.useFakeTimers();
    const url = beginSignIn({ provider: github, host: 'github.com' });
    vi.advanceTimersByTime(11 * 60 * 1000);
    await expect(
      completeSignIn(`git-desktop-auth://oauth?code=abc&state=${stateOf(url)}`),
    ).rejects.toThrow(/took too long/);
  });

  it('surfaces an error the provider put in the callback', async () => {
    const url = beginSignIn({ provider: github, host: 'github.com' });
    await expect(
      completeSignIn(
        `git-desktop-auth://oauth?error=access_denied&error_description=Nope&state=${stateOf(url)}`,
      ),
    ).rejects.toThrow('Nope');
  });

  // GitHub answers HTTP 200 with an error object. Trusting the status alone
  // would turn a failed sign-in into an apparently successful one.
  it('treats an error body as a failure even on HTTP 200', async () => {
    const url = beginSignIn({ provider: github, host: 'github.com' });
    stubFetch(() => ({ error: 'bad_verification_code', error_description: 'Code expired' }));
    await expect(
      completeSignIn(`git-desktop-auth://oauth?code=abc&state=${stateOf(url)}`),
    ).rejects.toThrow('Code expired');
  });

  it('returns the account and token on a successful exchange', async () => {
    const url = beginSignIn({ provider: github, host: 'github.com' });
    stubFetch(() => ({ access_token: 'tok', expires_in: 3600, refresh_token: 'ref' }), {
      login: 'octocat',
      id: 7,
      name: 'The Octocat',
      email: 'octo@example.com',
      avatar_url: null,
    });

    const result = await completeSignIn(`git-desktop-auth://oauth?code=abc&state=${stateOf(url)}`);
    expect(result.account).toMatchObject({
      providerId: 'github',
      host: 'github.com',
      login: 'octocat',
      email: 'octo@example.com',
    });
    expect(result.token.accessToken).toBe('tok');
    expect(result.token.refreshToken).toBe('ref');
    expect(result.token.expiresAt).toBeGreaterThan(Date.now());
  });
});

/**
 * One fetch stub for both halves of the flow: the POST to the token endpoint
 * and the GETs that follow it. `onToken` sees the encoded request body.
 */
function stubFetch(
  onToken: (body: string) => Record<string, unknown>,
  user: Record<string, unknown> = {},
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: { method?: string; body?: string }) => {
      const json = init?.method === 'POST' ? onToken(init.body ?? '') : bodyFor(input, user);
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve(json),
      });
    }),
  );
}

function bodyFor(url: string, user: Record<string, unknown>): unknown {
  if (url.endsWith('/user/emails')) return [];
  return user;
}
