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
});
