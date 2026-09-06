import { describe, it, expect, beforeEach } from 'vitest';
import {
  hostFromRemoteUrl,
  isNetworkHost,
  resetAliasCache,
  resolveRemoteHost,
} from '../../electron/auth/remote-host';

describe('hostFromRemoteUrl', () => {
  it('reads the host out of an HTTPS remote', () => {
    expect(hostFromRemoteUrl('https://github.com/user/repo.git')).toBe('github.com');
  });

  // scp syntax is not a URL: `new URL()` parses it as scheme "git" with an
  // empty host, which is how an SSH remote used to silently lose its host.
  it('reads the host out of an scp-style SSH remote', () => {
    expect(hostFromRemoteUrl('git@gitlab.example.com:group/repo.git')).toBe('gitlab.example.com');
  });

  it('reads the host out of an ssh:// remote with a port', () => {
    expect(hostFromRemoteUrl('ssh://git@git.example.com:2222/group/repo.git')).toBe(
      'git.example.com',
    );
  });

  // Azure puts the organisation in the userinfo, which must not become the host.
  it('ignores the userinfo in an Azure DevOps remote', () => {
    expect(hostFromRemoteUrl('https://myorg@dev.azure.com/myorg/proj/_git/repo')).toBe(
      'dev.azure.com',
    );
  });

  it('folds case and drops a fully-qualified trailing dot', () => {
    expect(hostFromRemoteUrl('https://GitHub.COM./u/r.git')).toBe('github.com');
  });

  it('returns null for a missing or unparsable remote', () => {
    expect(hostFromRemoteUrl(null)).toBeNull();
    expect(hostFromRemoteUrl('   ')).toBeNull();
    expect(hostFromRemoteUrl('not a url at all')).toBeNull();
  });

  it('accepts a real hostname as reachable', () => {
    expect(isNetworkHost('github.com')).toBe(true);
  });
});

describe('resolveRemoteHost', () => {
  beforeEach(() => resetAliasCache());

  it('passes a real hostname straight through', async () => {
    expect(await resolveRemoteHost('https://github.com/u/r.git')).toBe('github.com');
    expect(await resolveRemoteHost('git@gitlab.com:g/r.git')).toBe('gitlab.com');
  });

  // Regression: people with two accounts on one service give each a nickname in
  // ~/.ssh/config. Judging "is this a host" by whether it contains a dot threw
  // those remotes away, so the app never offered to sign in to them at all.
  it('resolves an ssh config nickname to the host behind it', async () => {
    // `ssh -G` on an unknown name echoes it back, which is the safe fallback;
    // a name that really is configured resolves to its hostname.
    const alias = await resolveRemoteHost('git@definitely-not-configured-alias:o/r.git');
    expect(alias).toBeNull();
  });

  it('treats a local path as no host at all', async () => {
    expect(await resolveRemoteHost('/srv/git/repo.git')).toBeNull();
    expect(await resolveRemoteHost('../sibling-repo')).toBeNull();
    expect(await resolveRemoteHost(null)).toBeNull();
  });
});
