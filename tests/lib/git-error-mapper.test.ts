import { describe, it, expect } from 'vitest';
import { classifyGitError } from '../../src/lib/git-error-mapper';

describe('classifyGitError', () => {
  it('classifies HTTPS authentication failure as auth with a credential-help action', () => {
    const r = classifyGitError("fatal: Authentication failed for 'https://github.com/x/y.git'");
    expect(r.kind).toBe('auth');
    expect(r.action).toBe('credentialHelp');
  });

  it('classifies a missing username prompt as auth', () => {
    expect(classifyGitError('fatal: could not read Username for https://github.com').kind).toBe(
      'auth',
    );
  });

  it('classifies an SSH permission denial as auth', () => {
    expect(classifyGitError('git@github.com: Permission denied (publickey).').kind).toBe('auth');
  });

  it('treats an HTTP 403 as auth even though it mentions "unable to access"', () => {
    const r = classifyGitError(
      "fatal: unable to access 'https://x/': The requested URL returned error: 403",
    );
    expect(r.kind).toBe('auth');
  });

  it('classifies a missing upstream as noUpstream with a publish-branch action', () => {
    const r = classifyGitError('fatal: The current branch feature has no upstream branch.');
    expect(r.kind).toBe('noUpstream');
    expect(r.action).toBe('publishBranch');
  });

  it('classifies "no tracking information" as noUpstream', () => {
    expect(classifyGitError('There is no tracking information for the current branch.').kind).toBe(
      'noUpstream',
    );
  });

  it('classifies a merge conflict as conflict', () => {
    expect(classifyGitError('CONFLICT (content): Merge conflict in src/a.ts').kind).toBe(
      'conflict',
    );
    expect(classifyGitError('Automatic merge failed; fix conflicts and then commit.').kind).toBe(
      'conflict',
    );
  });

  it('classifies uncommitted-changes-would-be-overwritten as uncommitted', () => {
    expect(
      classifyGitError(
        'Your local changes to the following files would be overwritten by checkout:',
      ).kind,
    ).toBe('uncommitted');
  });

  it('classifies "not a git repository" as notRepo', () => {
    expect(classifyGitError('fatal: not a git repository (or any parent up to /): .git').kind).toBe(
      'notRepo',
    );
  });

  it('classifies an unreachable host as network', () => {
    expect(
      classifyGitError("fatal: unable to access 'https://x/': Could not resolve host: github.com")
        .kind,
    ).toBe('network');
  });

  it('classifies a failing pre-commit hook as hook', () => {
    expect(classifyGitError('pre-commit hook failed (exit code 1)').kind).toBe('hook');
  });

  it('accepts an Error instance', () => {
    expect(classifyGitError(new Error('Authentication failed')).kind).toBe('auth');
  });

  it('falls back to unknown for unrecognized errors', () => {
    const r = classifyGitError('something totally unexpected happened');
    expect(r.kind).toBe('unknown');
    expect(r.action).toBeUndefined();
  });

  // Taken verbatim from git when signing with a passphrase-protected key that
  // the agent does not hold. Fails fast rather than hanging, but must still
  // point the user somewhere.
  it('treats a locked signing key as an auth problem', () => {
    const r = classifyGitError(
      'error: Enter passphrase for "/home/j/.ssh/id_ed25519": Load key: incorrect passphrase supplied to decrypt private key?\nfatal: failed to write commit object',
    );
    expect(r.kind).toBe('auth');
    expect(r.action).toBe('credentialHelp');
  });

  it('does not mistake unrelated failures for auth problems', () => {
    expect(classifyGitError('fatal: pathspec did not match any files').kind).not.toBe('auth');
    expect(classifyGitError('error: your local changes would be overwritten').kind).not.toBe(
      'auth',
    );
  });

  // Deleting the key file while the profile is still applied: git keeps the
  // config, so commits fail outright until the config is cleared.
  it('treats a missing signing key as an auth problem', () => {
    const r = classifyGitError(
      "error: Couldn't load public key /home/j/.ssh/id_ed25519.pub: No such file or directory?\nfatal: failed to write commit object",
    );
    expect(r.kind).toBe('auth');
    expect(r.action).toBe('credentialHelp');
  });

  it('treats a missing ssh identity file as an auth problem', () => {
    const r = classifyGitError(
      'Warning: Identity file /home/j/.ssh/id_ed25519 not accessible: No such file or directory.',
    );
    expect(r.kind).toBe('auth');
  });
});
