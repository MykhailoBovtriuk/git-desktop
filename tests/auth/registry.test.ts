import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  allProviders,
  isConfigured,
  providerById,
  providerForHost,
  providerOptions,
} from '../../electron/auth/providers/registry';
import { resetKeyCache } from '../../electron/auth/oauth-config';

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

  // Most Git servers are somebody's own instance. "Unknown" is a question for
  // the user, not a failure.
  it('claims nothing for an unknown host', () => {
    expect(providerForHost('git.acme.internal')).toBeNull();
  });

  it('matches hosts case-insensitively', () => {
    expect(providerForHost('GitHub.com')?.id).toBe('github');
  });

  // A provider whose flow this build cannot finish must not appear in the
  // picker: choosing it would dead-end at the token exchange.
  it('hides a provider whose client id this build lacks', () => {
    expect(isConfigured('gitlab')).toBe(false);
    process.env.OAUTH_GITLAB_ID = 'abc';
    resetKeyCache();
    expect(isConfigured('gitlab')).toBe(true);
  });

  it('hides a secret-requiring provider that has only half its keys', () => {
    process.env.OAUTH_GITHUB_ID = 'abc';
    resetKeyCache();
    expect(isConfigured('github')).toBe(false);
    process.env.OAUTH_GITHUB_SECRET = 'shh';
    resetKeyCache();
    expect(isConfigured('github')).toBe(true);
  });

  // These need no baked-in key — the user brings one with the server address,
  // or brings a token instead — so a fork with no secrets still has a way in.
  // Regression: Gitea was treated as a hosted service, so a build without a
  // Gitea client id hid Codeberg and every self-hosted Forgejo from the picker.
  it('always offers the self-hosted and token paths', () => {
    for (const id of ['token', 'gitlab-self', 'github-enterprise', 'gitea'] as const) {
      expect(isConfigured(id), id).toBe(true);
    }

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

  // Regression: needing an address and needing a client id are different
  // questions. Codeberg needs no address, and asking it for a client id the
  // build already carries left the sign-in button permanently disabled.
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

  it('resolves every provider it lists by id', () => {
    for (const provider of allProviders()) {
      expect(providerById(provider.id)?.id).toBe(provider.id);
    }
  });
});
