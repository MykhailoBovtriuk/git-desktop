import { describe, it, expect, afterEach, vi } from 'vitest';
import { providerById } from '../../../electron/auth/providers/registry';

/**
 * One test per provider, against a recorded response shape.
 *
 * These are the only places a provider's API vocabulary is translated into the
 * app's, so they are the only places a rename upstream can silently produce an
 * account with a blank name or, worse, a blank commit email.
 */
function stubJson(routes: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const key = Object.keys(routes).find(k => url.includes(k));
      if (key === undefined) return Promise.resolve({ ok: false, status: 404 });
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve(routes[key]),
      });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('github', () => {
  it('prefers the verified primary email over the profile one', async () => {
    stubJson({
      '/user/emails': [
        { email: 'old@example.com', primary: false, verified: true },
        { email: 'primary@example.com', primary: true, verified: true },
      ],
      '/user': { login: 'octocat', id: 7, name: 'The Octocat', email: 'stale@example.com' },
    });

    const account = await providerById('github')!.fetchAccount('github.com', 'tok');
    expect(account).toMatchObject({
      providerId: 'github',
      host: 'github.com',
      displayName: 'GitHub',
      login: 'octocat',
      name: 'The Octocat',
      email: 'primary@example.com',
    });
  });

  // GitHub hides emails by default. A blank address here would make git reject
  // the very first commit, so the documented noreply form stands in.
  it('falls back to the noreply address when the email is hidden', async () => {
    stubJson({
      '/user/emails': [],
      '/user': { login: 'octocat', id: 7, name: null, email: null },
    });
    const account = await providerById('github')!.fetchAccount('github.com', 'tok');
    expect(account.email).toBe('7+octocat@users.noreply.github.com');
  });

  it('puts the enterprise API under /api/v3 on the instance itself', () => {
    const endpoints = providerById('github-enterprise')!.endpoints('git.acme.internal');
    expect(endpoints.apiBase).toBe('https://git.acme.internal/api/v3');
    expect(endpoints.authorizeUrl).toBe('https://git.acme.internal/login/oauth/authorize');
  });
});

describe('gitlab', () => {
  // commit_email is the address GitLab attributes commits to; the account
  // email is not always the same one.
  it('commits as the commit email, not the account email', async () => {
    stubJson({
      '/api/v4/user': {
        username: 'jane',
        name: 'Jane Doe',
        email: 'account@example.com',
        commit_email: 'commits@example.com',
        public_email: null,
        avatar_url: null,
      },
    });
    const account = await providerById('gitlab')!.fetchAccount('gitlab.com', 'tok');
    expect(account).toMatchObject({ login: 'jane', email: 'commits@example.com' });
  });

  it('asks for the scopes push actually needs', () => {
    expect(providerById('gitlab')!.scopes).toContain('write_repository');
  });

  it('points a self-managed instance at its own host', () => {
    const endpoints = providerById('gitlab-self')!.endpoints('gitlab.acme.internal');
    expect(endpoints.tokenUrl).toBe('https://gitlab.acme.internal/oauth/token');
  });
});

describe('bitbucket', () => {
  it('takes the confirmed primary email from the separate endpoint', async () => {
    stubJson({
      '/2.0/user/emails': {
        values: [
          { email: 'other@example.com', is_primary: false, is_confirmed: true },
          { email: 'me@example.com', is_primary: true, is_confirmed: true },
        ],
      },
      '/2.0/user': {
        username: 'janed',
        nickname: 'jane',
        display_name: 'Jane Doe',
        links: { avatar: {} },
      },
    });
    const account = await providerById('bitbucket')!.fetchAccount('bitbucket.org', 'tok');
    expect(account).toMatchObject({ login: 'janed', name: 'Jane Doe', email: 'me@example.com' });
  });
});

describe('gitea', () => {
  it('reads the Gitea profile shape', async () => {
    stubJson({
      '/api/v1/user': {
        login: 'forge',
        full_name: 'Forge User',
        email: 'forge@example.com',
        avatar_url: null,
      },
    });
    const account = await providerById('gitea')!.fetchAccount('codeberg.org', 'tok');
    expect(account).toMatchObject({ login: 'forge', name: 'Forge User' });
  });
});

describe('azure-devops', () => {
  it('reads the Entra profile and uses the email as the login', async () => {
    stubJson({
      '/_apis/profile/profiles/me': {
        displayName: 'Jane Doe',
        emailAddress: 'jane@contoso.com',
      },
    });
    const account = await providerById('azure-devops')!.fetchAccount('dev.azure.com', 'tok');
    expect(account).toMatchObject({ login: 'jane@contoso.com', email: 'jane@contoso.com' });
  });

  // offline_access is what makes a refresh token appear; without it the hour-
  // long access token expires with no way back short of a fresh sign-in.
  it('asks for offline access so the token can be refreshed', () => {
    expect(providerById('azure-devops')!.scopes).toContain('offline_access');
  });
});

describe('token', () => {
  // The account comes from the form; there is no API to ask. Returning a
  // hollow account instead would show a signed-in user with no name.
  it('refuses to invent an account', async () => {
    await expect(providerById('token')!.fetchAccount('git.acme.internal', 'tok')).rejects.toThrow();
  });
});
