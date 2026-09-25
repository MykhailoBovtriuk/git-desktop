/**
 * Just enough semver to rank release tags.
 *
 * A dependency for this would be the only runtime package the updater adds,
 * and the comparison it needs is forty lines: ranking `1.10.0` above `1.9.0`,
 * keeping a pre-release below the release it leads to, and refusing to guess
 * at tags that are not versions at all.
 */
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  /** Dot-separated identifiers after the `-`; numeric ones arrive as numbers. */
  prerelease: (string | number)[];
}

const PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9a-z.-]+))?$/i;

/**
 * `null` for anything that is not a version.
 *
 * Releases carry whatever tag their author typed, so a `nightly` or a
 * `2026-09-release` has to be skipped rather than crash the check or, worse,
 * sort as `0.0.0`.
 */
export function parseSemver(raw: string): SemVer | null {
  if (typeof raw !== 'string') return null;

  // Tags are written `v1.1.0`; build metadata never affects precedence.
  const cleaned = raw.trim().replace(/^v/i, '').split('+')[0];
  const match = PATTERN.exec(cleaned);
  if (!match) return null;

  const [, major, minor, patch, prerelease] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease
      ? prerelease.split('.').map(id => (/^\d+$/.test(id) ? Number(id) : id))
      : [],
  };
}

/** Negative when `a` precedes `b`, positive when it follows, 0 when equal. */
export function compareSemver(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;

  // "1.2.0-beta.1" ships before "1.2.0", so having a pre-release at all is
  // what makes a version the earlier of the two.
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;

  for (let i = 0; i < Math.min(a.prerelease.length, b.prerelease.length); i += 1) {
    const left = a.prerelease[i];
    const right = b.prerelease[i];
    if (left === right) continue;

    const leftNumeric = typeof left === 'number';
    const rightNumeric = typeof right === 'number';
    // Numeric identifiers compare as numbers — otherwise "beta.10" would sort
    // below "beta.9" — and always rank below alphanumeric ones.
    if (leftNumeric && rightNumeric) return (left as number) - (right as number);
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return String(left) < String(right) ? -1 : 1;
  }

  // Equal so far: the one carrying more identifiers is the later of the two.
  return a.prerelease.length - b.prerelease.length;
}

/**
 * Whether `candidate` is worth offering to someone running `current`.
 *
 * Unparseable input is never an update: a junk tag must not talk anyone into
 * downloading anything.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  const next = parseSemver(candidate);
  const now = parseSemver(current);
  if (!next || !now) return false;
  return compareSemver(next, now) > 0;
}
