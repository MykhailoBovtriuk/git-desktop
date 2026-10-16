import { describe, it, expect, afterEach, vi } from 'vitest';
import { providerById } from '../../../electron/auth/providers/registry';

type Answer = { status: number; headers?: Record<string, string>; body?: unknown } | 'down';

function stubFetch(routes: Record<string, Answer>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const key = Object.keys(routes).find(k => url.includes(k));
      const answer = key === undefined ? { status: 404 } : routes[key];
      if (answer === 'down') return Promise.reject(new Error('ENOTFOUND'));
      return Promise.resolve({
        ok: answer.status < 300,
        status: answer.status,
        headers: new Headers(answer.headers ?? {}),
        json: () =>
          answer.body === undefined
            ? Promise.reject(new Error('no json'))
            : Promise.resolve(answer.body),
      });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const probe = (id: Parameters<typeof providerById>[0], host: string) =>
  providerById(id)!.probe!(host);

describe('GitHub Enterprise probe', () => {
  it('recognises a Server by its API headers', async () => {
    const calls = stubFetch({
      '/api/v3/meta': { status: 200, headers: { 'x-github-enterprise-version': '3.14' }, body: {} },
    });
    expect(await probe('github-enterprise', 'ghe.acme.com')).toBe('ok');
    expect(calls[0].url).toBe('https://ghe.acme.com/api/v3/meta');
  });

  it('accepts a private-mode Server that answers 401', async () => {
    stubFetch({ '/meta': { status: 401, headers: { 'x-github-request-id': 'abc' } } });
    expect(await probe('github-enterprise', 'ghe.acme.com')).toBe('ok');
  });

  it('asks a ghe.com tenant at its api host', async () => {
    const calls = stubFetch({
      'api.acme.ghe.com/meta': { status: 200, headers: { 'x-github-request-id': 'x' } },
    });
    expect(await probe('github-enterprise', 'acme.ghe.com')).toBe('ok');
    expect(calls[0].url).toBe('https://api.acme.ghe.com/meta');
  });

  it('tells another product apart', async () => {
    stubFetch({ '/meta': { status: 404, headers: { 'x-gitlab-meta': '{}' } } });
    expect(await probe('github-enterprise', 'gitlab.acme.com')).toBe('mismatch');
  });

  it('tells a dead address apart from the wrong product', async () => {
    stubFetch({ '/meta': 'down' });
    expect(await probe('github-enterprise', 'nowhere.acme.com')).toBe('unreachable');
  });
});

describe('GitLab and Gitea probes', () => {
  it('recognises GitLab from its anonymous 401', async () => {
    stubFetch({ '/api/v4/version': { status: 401, body: { message: '401 Unauthorized' } } });
    expect(await probe('gitlab-self', 'gitlab.acme.com')).toBe('ok');
  });

  it('does not take any 401 for GitLab', async () => {
    stubFetch({ '/api/v4/version': { status: 401 } });
    expect(await probe('gitlab-self', 'gitlab.acme.com')).toBe('mismatch');
  });

  it('recognises Gitea and Forgejo by their public version', async () => {
    stubFetch({ '/api/v1/version': { status: 200, body: { version: '9.0.0' } } });
    expect(await probe('gitea', 'git.acme.com')).toBe('ok');
  });
});

describe('token revocation', () => {
  it('deletes a GitHub token as the OAuth app itself', async () => {
    const calls = stubFetch({ '/applications/cid/token': { status: 204 } });
    await providerById('github')!.revokeToken!({
      host: 'github.com',
      token: 'tok',
      clientId: 'cid',
      clientSecret: 'sec',
    });

    expect(calls[0].url).toBe('https://api.github.com/applications/cid/token');
    expect(calls[0].init?.method).toBe('DELETE');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('cid:sec').toString('base64')}`);
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ access_token: 'tok' });
  });

  it('leaves a token the app did not issue alone', async () => {
    const calls = stubFetch({});
    await providerById('github')!.revokeToken!({
      host: 'github.com',
      token: 'ghp_x',
      clientId: '',
      clientSecret: null,
    });
    expect(calls).toHaveLength(0);
  });

  it('revokes a GitLab token with the public client id', async () => {
    const calls = stubFetch({ '/oauth/revoke': { status: 200 } });
    await providerById('gitlab')!.revokeToken!({
      host: 'gitlab.com',
      token: 'tok',
      clientId: 'cid',
      clientSecret: null,
    });
    expect(calls[0].url).toBe('https://gitlab.com/oauth/revoke');
    expect(String(calls[0].init?.body)).toBe('client_id=cid&token=tok');
  });

  it('swallows a failed revocation', async () => {
    stubFetch({ '/oauth/revoke': 'down' });
    await expect(
      providerById('gitlab')!.revokeToken!({
        host: 'gitlab.com',
        token: 'tok',
        clientId: 'cid',
        clientSecret: null,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('Bitbucket Data Center', () => {
  it('recognises the server by its public application properties', async () => {
    stubFetch({
      '/rest/api/1.0/application-properties': {
        status: 200,
        body: { version: '9.4.0', displayName: 'Bitbucket' },
      },
    });
    expect(await probe('bitbucket-server', 'bitbucket.acme.com')).toBe('ok');
  });

  it('tells another product apart', async () => {
    stubFetch({ '/application-properties': { status: 404 } });
    expect(await probe('bitbucket-server', 'gitlab.acme.com')).toBe('mismatch');
  });

  it('learns who the token belongs to from X-AUSERNAME', async () => {
    const calls = stubFetch({
      '/application-properties': { status: 200, headers: { 'x-ausername': 'jdoe' }, body: {} },
      '/rest/api/1.0/users/jdoe': {
        status: 200,
        body: {
          name: 'jdoe',
          slug: 'jdoe',
          displayName: 'Jane Doe',
          emailAddress: 'jane@acme.com',
        },
      },
    });

    const account = await providerById('bitbucket-server')!.fetchAccount(
      'bitbucket.acme.com',
      'tok',
    );
    expect(account).toMatchObject({
      providerId: 'bitbucket-server',
      login: 'jdoe',
      name: 'Jane Doe',
      email: 'jane@acme.com',
    });
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('treats an answer without a user as a rejected token', async () => {
    stubFetch({ '/application-properties': { status: 200, body: {} } });
    await expect(
      providerById('bitbucket-server')!.fetchAccount('bitbucket.acme.com', 'tok'),
    ).rejects.toThrow(/returned 401/);
  });
});

describe('Azure DevOps Server', () => {
  it('recognises the server by its headers, at the root or under /tfs', async () => {
    const calls = stubFetch({
      'devops.acme.com/_apis': { status: 404 },
      '/tfs/_apis/connectionData': { status: 401, headers: { 'x-tfs-processid': 'x' } },
    });
    expect(await probe('azure-devops-server', 'devops.acme.com')).toBe('ok');
    expect(calls.map(c => c.url)).toEqual([
      'https://devops.acme.com/_apis/connectionData',
      'https://devops.acme.com/tfs/_apis/connectionData',
    ]);
  });

  it('says so when nothing answers', async () => {
    stubFetch({ '/_apis/connectionData': 'down' });
    expect(await probe('azure-devops-server', 'nowhere.acme.com')).toBe('unreachable');
  });

  it('names the user from connectionData, sending the token as Basic', async () => {
    const calls = stubFetch({
      '/_apis/connectionData': {
        status: 200,
        body: {
          authenticatedUser: {
            providerDisplayName: 'Jane Doe',
            properties: { Account: { $value: 'ACME\\jdoe' } },
          },
        },
      },
    });
    const account = await providerById('azure-devops-server')!.fetchAccount(
      'devops.acme.com',
      'pat',
    );
    expect(account).toMatchObject({ login: 'ACME\\jdoe', name: 'Jane Doe', email: '' });
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from(':pat').toString('base64')}`,
    );
  });

  it('rejects a token neither root accepts', async () => {
    stubFetch({ '/_apis/connectionData': { status: 401 } });
    await expect(
      providerById('azure-devops-server')!.fetchAccount('devops.acme.com', 'bad'),
    ).rejects.toThrow(/returned 401/);
  });
});
