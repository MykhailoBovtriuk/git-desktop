import { describe, it, expect, beforeEach } from 'vitest';
import {
  hostFromRemoteUrl,
  isNetworkHost,
  protocolFromRemoteUrl,
  httpsUrlFromSshRemote,
  sshUrlFromHttpsRemote,
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

  // Regression: SSH aliases from ~/.ssh/config were discarded for lacking a
  // dot.
  it('resolves an ssh config nickname to the host behind it', async () => {
    // `ssh -G` on an unknown name echoes it back, which is the safe fallback;
    // a name that really is configured resolves to its hostname.
    const alias = await resolveRemoteHost('git@definitely-not-configured-alias:o/r.git');
    expect(alias).toBeNull();
  });

  it('treats a local path as no host at all', async () => {
    expect(await resolveRemoteHost('/srv/git/repo.git')).toBeNull();
    expect(await resolveRemoteHost('../sibling-repo')).toBeNull();
    // A Windows drive letter is not an scp host named "c".
    expect(await resolveRemoteHost('C:\\Users\\me\\repo.git')).toBeNull();
    expect(await resolveRemoteHost('C:/Users/me/repo.git')).toBeNull();
    expect(await resolveRemoteHost(null)).toBeNull();
  });
});

describe('protocolFromRemoteUrl', () => {
  it('reads scp syntax as ssh', () => {
    expect(protocolFromRemoteUrl('git@github.com:owner/repo.git')).toBe('ssh');
    expect(protocolFromRemoteUrl('github-work:owner/repo.git')).toBe('ssh');
  });

  it('reads explicit schemes', () => {
    expect(protocolFromRemoteUrl('ssh://git@github.com/owner/repo.git')).toBe('ssh');
    expect(protocolFromRemoteUrl('https://github.com/owner/repo.git')).toBe('https');
    expect(protocolFromRemoteUrl('http://git.example.com/owner/repo.git')).toBe('https');
  });

  // Nothing a stored token applies to, so the sign-in offer must stay away.
  it('calls anything else neither', () => {
    expect(protocolFromRemoteUrl('git://github.com/owner/repo.git')).toBe('other');
    expect(protocolFromRemoteUrl('file:///srv/repo.git')).toBe('other');
    expect(protocolFromRemoteUrl('/srv/repo.git')).toBe('other');
    expect(protocolFromRemoteUrl('C:\\Users\\me\\repo.git')).toBe('other');
    expect(protocolFromRemoteUrl('')).toBeNull();
    expect(protocolFromRemoteUrl(null)).toBeNull();
  });
});

describe('httpsUrlFromSshRemote', () => {
  it('rewrites scp syntax onto the resolved host, keeping the path', () => {
    expect(httpsUrlFromSshRemote('git@github-work:owner/repo.git', 'github.com')).toBe(
      'https://github.com/owner/repo.git',
    );
  });

  it('rewrites an ssh:// url, dropping the user and the ssh port', () => {
    expect(
      httpsUrlFromSshRemote('ssh://git@git.example.com:2222/group/repo.git', 'git.example.com'),
    ).toBe('https://git.example.com/group/repo.git');
    expect(httpsUrlFromSshRemote('git+ssh://git@github.com/o/r', 'github.com')).toBe(
      'https://github.com/o/r',
    );
  });

  // Nothing to convert, or a path an https server would not recognise.
  it('refuses what is not an ssh remote', () => {
    expect(httpsUrlFromSshRemote('https://github.com/o/r.git', 'github.com')).toBeNull();
    expect(httpsUrlFromSshRemote('/srv/repo.git', 'github.com')).toBeNull();
    expect(httpsUrlFromSshRemote('git@github.com:~user/repo.git', 'github.com')).toBeNull();
    expect(httpsUrlFromSshRemote('git@github.com:', 'github.com')).toBeNull();
    expect(httpsUrlFromSshRemote(null, 'github.com')).toBeNull();
  });
});

describe('sshUrlFromHttpsRemote', () => {
  it('rewrites an https url to scp syntax, dropping user and port', () => {
    expect(sshUrlFromHttpsRemote('https://github.com/owner/repo.git')).toBe(
      'git@github.com:owner/repo.git',
    );
    expect(sshUrlFromHttpsRemote('https://me@git.example.com:8443/g/r')).toBe(
      'git@git.example.com:g/r',
    );
  });

  it('refuses what is not an https remote', () => {
    expect(sshUrlFromHttpsRemote('git@github.com:o/r.git')).toBeNull();
    expect(sshUrlFromHttpsRemote('https://github.com/')).toBeNull();
    expect(sshUrlFromHttpsRemote(null)).toBeNull();
  });
});
