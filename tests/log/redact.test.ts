import { describe, it, expect } from 'vitest';
import { redact } from '../../electron/log/redact';

describe('redact', () => {
  it('masks credentials embedded in a URL', () => {
    expect(redact('fatal: unable to access https://user:s3cret@github.com/a/b.git/')).toBe(
      'fatal: unable to access https://***@github.com/a/b.git/',
    );
    expect(redact('https://ghp_abc@host/x')).toBe('https://***@host/x');
  });

  it('leaves scp-style ssh remotes alone', () => {
    expect(redact('To git@github.com:a/b.git')).toBe('To git@github.com:a/b.git');
  });

  it('masks authorization headers', () => {
    expect(redact('http.extraheader=Authorization: Bearer abc.def')).toBe(
      'http.extraheader=Authorization: Bearer ***',
    );
  });

  it('masks provider token shapes', () => {
    expect(redact('token ghp_0123456789abcdefghijABCDEFGHIJ')).toBe('token ***');
    expect(redact('glpat-0123456789abcdefghij')).toBe('***');
    expect(redact('github_pat_0123456789abcdefghij_xyz')).toBe('***');
  });

  it('keeps ordinary git output intact', () => {
    const out = '   a1b2c3d..e4f5a6b  dev -> dev\nEverything up-to-date';
    expect(redact(out)).toBe(out);
  });
});
