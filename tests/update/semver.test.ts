import { describe, it, expect } from 'vitest';
import { parseSemver, compareSemver, isNewerVersion } from '../../electron/update/semver';

const parsed = (raw: string) => {
  const value = parseSemver(raw);
  if (!value) throw new Error(`expected ${raw} to parse`);
  return value;
};

describe('parseSemver', () => {
  it('reads a release tag as written on GitHub', () => {
    expect(parseSemver('v1.1.0')).toEqual({ major: 1, minor: 1, patch: 0, prerelease: [] });
  });

  it('keeps numeric pre-release identifiers numeric', () => {
    expect(parseSemver('1.2.0-beta.10')).toEqual({
      major: 1,
      minor: 2,
      patch: 0,
      prerelease: ['beta', 10],
    });
  });

  it('ignores build metadata, which carries no precedence', () => {
    expect(parseSemver('1.2.0+20260924')).toEqual(parsed('1.2.0'));
  });

  // A tag is whatever its author typed; the check has to skip the rest rather
  // than treat it as 0.0.0 and offer a downgrade.
  it('returns null for tags that are not versions', () => {
    for (const raw of ['nightly', '', '1.2', '1.2.3.4', 'v', 'latest']) {
      expect(parseSemver(raw), raw).toBeNull();
    }
  });
});

describe('compareSemver', () => {
  it('compares numbers, not strings', () => {
    expect(compareSemver(parsed('1.10.0'), parsed('1.9.0'))).toBeGreaterThan(0);
    expect(compareSemver(parsed('2.0.0'), parsed('1.99.99'))).toBeGreaterThan(0);
    expect(compareSemver(parsed('1.1.0'), parsed('1.1.0'))).toBe(0);
  });

  it('sorts a pre-release below the release it leads to', () => {
    expect(compareSemver(parsed('1.2.0-beta.1'), parsed('1.2.0'))).toBeLessThan(0);
    expect(compareSemver(parsed('1.2.0'), parsed('1.2.0-beta.1'))).toBeGreaterThan(0);
  });

  it('orders pre-release identifiers by semver rules', () => {
    expect(compareSemver(parsed('1.2.0-beta.10'), parsed('1.2.0-beta.9'))).toBeGreaterThan(0);
    expect(compareSemver(parsed('1.2.0-alpha'), parsed('1.2.0-beta'))).toBeLessThan(0);
    // Numeric identifiers rank below alphanumeric ones.
    expect(compareSemver(parsed('1.2.0-1'), parsed('1.2.0-alpha'))).toBeLessThan(0);
    // Equal prefix: more identifiers wins.
    expect(compareSemver(parsed('1.2.0-beta.1'), parsed('1.2.0-beta'))).toBeGreaterThan(0);
  });
});

describe('isNewerVersion', () => {
  it('answers the question the update check actually asks', () => {
    expect(isNewerVersion('1.2.0', '1.1.0')).toBe(true);
    expect(isNewerVersion('v1.2.0', '1.1.0')).toBe(true);
    expect(isNewerVersion('1.1.0', '1.1.0')).toBe(false);
    expect(isNewerVersion('1.0.2', '1.1.0')).toBe(false);
  });

  // Between a version bump and its release the running app is ahead of every
  // tag — that is "up to date", not an update.
  it('treats a version ahead of every release as current', () => {
    expect(isNewerVersion('1.1.0', '1.2.0')).toBe(false);
  });

  it('never offers an update it could not parse', () => {
    expect(isNewerVersion('nightly', '1.1.0')).toBe(false);
    expect(isNewerVersion('1.2.0', 'not-a-version')).toBe(false);
  });
});
