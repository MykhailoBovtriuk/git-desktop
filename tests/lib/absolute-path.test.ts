import { describe, it, expect } from 'vitest';
import { absolutePathIn } from '../../src/lib/absolute-path';

describe('absolutePathIn', () => {
  it('joins a repository root with the path git reports', () => {
    expect(absolutePathIn('/Users/me/work/repo', 'src/app.ts')).toBe(
      '/Users/me/work/repo/src/app.ts',
    );
  });

  it('does not double the separator on a root that ends with one', () => {
    expect(absolutePathIn('/Users/me/repo/', 'a.txt')).toBe('/Users/me/repo/a.txt');
  });

  // git reports "/" whatever the platform, while the repository root arrives
  // with the platform's own separator — joining blindly gives C:\repo/src/a.ts.
  it('speaks Windows when the root does', () => {
    expect(absolutePathIn('C:\\Users\\me\\repo', 'src/app.ts')).toBe(
      'C:\\Users\\me\\repo\\src\\app.ts',
    );
    expect(absolutePathIn('C:\\Users\\me\\repo\\', 'a.txt')).toBe('C:\\Users\\me\\repo\\a.txt');
  });

  // No repository open yet: copying a bare relative path beats copying
  // something that looks absolute and points nowhere.
  it('returns the relative path when there is no root', () => {
    expect(absolutePathIn(null, 'src/app.ts')).toBe('src/app.ts');
    expect(absolutePathIn('', 'src/app.ts')).toBe('src/app.ts');
  });

  it('leaves a path with spaces alone', () => {
    expect(absolutePathIn('/Users/me/my repo', 'some dir/a file.txt')).toBe(
      '/Users/me/my repo/some dir/a file.txt',
    );
  });
});
