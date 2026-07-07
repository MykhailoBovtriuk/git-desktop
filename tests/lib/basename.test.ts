import { describe, it, expect } from 'vitest';
import { basenameFromPath } from '../../src/lib/basename';

describe('basenameFromPath', () => {
  it('returns the last segment of a POSIX path', () => {
    expect(basenameFromPath('/home/me/repo')).toBe('repo');
  });

  it('returns the last segment of a Windows path', () => {
    expect(basenameFromPath('D:\\git\\repo')).toBe('repo');
  });

  it('returns the value itself when there is no separator', () => {
    expect(basenameFromPath('repo')).toBe('repo');
  });

  it('ignores a trailing POSIX slash', () => {
    expect(basenameFromPath('/home/me/repo/')).toBe('repo');
  });

  it('ignores a trailing Windows backslash', () => {
    expect(basenameFromPath('D:\\git\\repo\\')).toBe('repo');
  });

  it('handles mixed separators', () => {
    expect(basenameFromPath('C:/Users/me\\projects\\app')).toBe('app');
  });

  it('returns an empty string for empty input', () => {
    expect(basenameFromPath('')).toBe('');
  });
});
