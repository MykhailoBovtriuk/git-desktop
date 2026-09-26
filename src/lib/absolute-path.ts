/**
 * The repository root plus a git path, joined with the platform's separator:
 * git always uses "/".
 */
export function absolutePathIn(repoRoot: string | null | undefined, relative: string): string {
  if (!repoRoot) return relative;

  const windows = repoRoot.includes('\\') && !repoRoot.includes('/');
  const separator = windows ? '\\' : '/';
  const root = repoRoot.replace(/[\\/]+$/, '');
  const tail = windows ? relative.replace(/\//g, '\\') : relative;
  return `${root}${separator}${tail}`;
}
