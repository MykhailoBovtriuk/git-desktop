import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  allProviders,
  providerById,
  providerForHost,
  providerOptions,
} from '../../electron/auth/providers/registry';
import { keysFor, resetKeyCache } from '../../electron/auth/oauth-config';
import type { ProviderId } from '../../src/types';

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
  });

  it('no longer knows the removed providers', () => {
    expect(providerForHost('bitbucket.org')).toBeNull();
    expect(providerForHost('codeberg.org')).toBeNull();
    expect(allProviders().map(p => p.id)).toEqual([
      'github',
      'gitlab',
      'azure-devops',
      'github-enterprise',
      'gitlab-self',
      'azure-devops-server',
    ]);
    for (const id of ['bitbucket', 'bitbucket-server', 'gitea', 'token']) {
      expect(providerById(id as ProviderId)).toBeNull();
    }
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

  it('marks the providers that need a server address', () => {
    const needsHost = providerOptions()
      .filter(o => o.needsHost)
      .map(o => o.id);
    expect(needsHost).toEqual(['github-enterprise', 'gitlab-self', 'azure-devops-server']);
  });

  it('asks for a client id only when the build has none', () => {
    const option = (id: ProviderId) => providerOptions().find(o => o.id === id);
    expect(option('gitlab')?.needsClientId).toBe(true);
    process.env.OAUTH_GITLAB_ID = 'gl-id';
    resetKeyCache();
    expect(option('gitlab')?.needsClientId).toBe(false);
    expect(option('azure-devops-server')?.needsClientId).toBe(false);
  });

  it('lists every provider, saying which can open a browser', () => {
    const options = providerOptions();
    expect(options.map(o => o.id)).toEqual(allProviders().map(p => p.id));
    expect(options.find(o => o.id === 'github')).toMatchObject({
      group: 'github',
      defaultHost: 'github.com',
      configured: false,
    });
    process.env.OAUTH_GITHUB_ID = 'abc';
    process.env.OAUTH_GITHUB_SECRET = 'shh';
    resetKeyCache();
    expect(providerOptions().find(o => o.id === 'github')?.configured).toBe(true);
  });

  it('groups providers the way Settings lists them', () => {
    const group = (id: string) => providerOptions().find(o => o.id === id)?.group;
    expect(group('github-enterprise')).toBe('github-enterprise');
    expect(group('gitlab')).toBe('gitlab');
    expect(group('gitlab-self')).toBe('gitlab-self');
    for (const id of ['azure-devops', 'azure-devops-server']) expect(group(id)).toBe('other');
  });

  it('asks a build without keys for a secret only where the flow lacks PKCE', () => {
    const secret = (id: string) => providerOptions().find(o => o.id === id)?.needsClientSecret;
    for (const id of ['github', 'github-enterprise']) expect(secret(id)).toBe(true);
    for (const id of ['gitlab', 'gitlab-self', 'azure-devops', 'azure-devops-server'])
      expect(secret(id)).toBe(false);
  });

  it('asks for no secret once the build carries the keys', () => {
    process.env.OAUTH_GITHUB_ID = 'abc';
    process.env.OAUTH_GITHUB_SECRET = 'shh';
    resetKeyCache();
    expect(providerOptions().find(o => o.id === 'github')?.needsClientSecret).toBe(false);
  });

  it('offers only a token for a service without OAuth', () => {
    const server = providerOptions().find(o => o.id === 'azure-devops-server');
    expect(server).toMatchObject({ configured: false, needsClientId: false, needsHost: true });
  });

  it('resolves every provider it lists by id', () => {
    for (const provider of allProviders()) {
      expect(providerById(provider.id)?.id).toBe(provider.id);
    }
  });
});
