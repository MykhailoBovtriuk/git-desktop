export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: (string | number)[];
}

const PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9a-z.-]+))?$/i;

export function parseSemver(raw: string): SemVer | null {
  if (typeof raw !== 'string') return null;

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

  return a.prerelease.length - b.prerelease.length;
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const next = parseSemver(candidate);
  const now = parseSemver(current);
  if (!next || !now) return false;
  return compareSemver(next, now) > 0;
}
