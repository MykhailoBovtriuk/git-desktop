import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  allProviders,
  providerById,
  providerForHost,
  providerOptions,
} from '../../electron/auth/providers/registry';
import { keysFor, resetKeyCache } from '../../electron/auth/oauth-config';

describe('provider registry', () => {
  beforeEach(() => {
    resetKeyCache();
    delete process.env.OAUTH_GITHUB_ID;
    delete process.env.OAUTH_GITHUB_SECRET;
    delete process.env.OAUTH_GITLAB_ID;
  });
  afterEach(() => {
    delete process.env.OAUTH_GITHUB_ID;
    delete process.env.OAUTH_GITHUB_SECRET;
    delete process.env.OAUTH_GITLAB_ID;
    resetKeyCache();
  });

  it('claims the hosts it owns', () => {
    expect(providerForHost('github.com')?.id).toBe('github');
    expect(providerForHost('gitlab.com')?.id).toBe('gitlab');
    expect(providerForHost('dev.azure.com')?.id).toBe('azure-devops');
    expect(providerForHost('bitbucket.org')?.id).toBe('bitbucket');
    expect(providerForHost('codeberg.org')?.id).toBe('gitea');
  });

  it('claims nothing for an unknown host', () => {
    expect(providerForHost('git.acme.internal')).toBeNull();
  });

  it('matches hosts case-insensitively', () => {
    expect(providerForHost('GitHub.com')?.id).toBe('github');
  });

  it('hides a provider whose client id this build lacks', () => {
    expect(keysFor('gitlab')).toBeNull();
    process.env.OAUTH_GITLAB_ID = 'abc';
    resetKeyCache();
    expect(keysFor('gitlab')).not.toBeNull();
  });

  it('hides a secret-requiring provider that has only half its keys', () => {
    process.env.OAUTH_GITHUB_ID = 'abc';
    resetKeyCache();
    expect(keysFor('github')).toBeNull();
    process.env.OAUTH_GITHUB_SECRET = 'shh';
    resetKeyCache();
    expect(keysFor('github')).not.toBeNull();
  });

  it('always offers the self-hosted and token paths', () => {
    const ids = providerOptions('git.acme.internal').map(o => o.id);
    expect(ids).toContain('token');
    expect(ids).toContain('gitlab-self');
    expect(ids).toContain('github-enterprise');
    expect(ids).toContain('gitea');
  });

  it('marks the providers that need a server address', () => {
    const options = providerOptions('git.acme.internal');
    expect(options.find(o => o.id === 'gitlab-self')?.needsHost).toBe(true);
    expect(options.find(o => o.id === 'token')?.needsHost).toBe(true);
  });

  it('asks for a client id only when the build has none', () => {
    process.env.OAUTH_GITEA_ID = 'gt-id';
    resetKeyCache();
    const withKey = providerOptions('codeberg.org');
    expect(withKey.find(o => o.id === 'gitea')?.needsClientId).toBe(false);
    expect(withKey.find(o => o.id === 'gitlab-self')?.needsClientId).toBe(true);
    expect(withKey.find(o => o.id === 'token')?.needsClientId).toBe(false);

    delete process.env.OAUTH_GITEA_ID;
    resetKeyCache();
    expect(providerOptions('git.acme.internal').find(o => o.id === 'gitea')?.needsClientId).toBe(
      true,
    );
  });

  it('lists every provider, saying which can open a browser', () => {
    const options = providerOptions(null);
    expect(options.map(o => o.id)).toEqual(allProviders().map(p => p.id));
    expect(options.find(o => o.id === 'github')).toMatchObject({
      group: 'github',
      defaultHost: 'github.com',
      configured: false,
    });
    process.env.OAUTH_GITHUB_ID = 'abc';
    process.env.OAUTH_GITHUB_SECRET = 'shh';
    resetKeyCache();
    expect(providerOptions(null).find(o => o.id === 'github')?.configured).toBe(true);
  });

  it('groups providers the way Settings lists them', () => {
    const group = (id: string) => providerOptions(null).find(o => o.id === id)?.group;
    expect(group('github-enterprise')).toBe('github-enterprise');
    expect(group('gitlab')).toBe('gitlab');
    expect(group('gitlab-self')).toBe('gitlab-self');
    for (const id of ['azure-devops', 'bitbucket', 'gitea', 'token'])
      expect(group(id)).toBe('other');
  });

  it("does not offer Codeberg's client id to another Gitea", () => {
    process.env.OAUTH_GITEA_ID = 'gt-id';
    resetKeyCache();
    expect(providerOptions('git.acme.internal').find(o => o.id === 'gitea')?.needsClientId).toBe(
      true,
    );
    delete process.env.OAUTH_GITEA_ID;
  });

  it('asks a build without keys for a secret only where the flow lacks PKCE', () => {
    const secret = (id: string) =>
      providerOptions('git.acme.internal').find(o => o.id === id)?.needsClientSecret;
    for (const id of ['github', 'github-enterprise', 'bitbucket']) expect(secret(id)).toBe(true);
    for (const id of ['gitlab', 'gitlab-self', 'gitea', 'azure-devops', 'bitbucket-server'])
      expect(secret(id)).toBe(false);
    for (const id of ['token', 'azure-devops-server']) expect(secret(id)).toBe(false);
  });

  it('asks for no secret once the build carries the keys', () => {
    process.env.OAUTH_GITHUB_ID = 'abc';
    process.env.OAUTH_GITHUB_SECRET = 'shh';
    resetKeyCache();
    expect(providerOptions(null).find(o => o.id === 'github')?.needsClientSecret).toBe(false);
  });

  it('offers only a token for a service without OAuth', () => {
    const server = providerOptions('devops.acme.com').find(o => o.id === 'azure-devops-server');
    expect(server).toMatchObject({ configured: false, needsClientId: false, needsHost: true });
  });

  it('resolves every provider it lists by id', () => {
    for (const provider of allProviders()) {
      expect(providerById(provider.id)?.id).toBe(provider.id);
    }
  });
});
