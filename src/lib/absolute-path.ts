/**
 * The path to paste into an editor: the repository root plus the path git
 * reported.
 *
 * git always reports "/" between segments, whatever the platform, while the
 * repository root arrives with the platform's own separator. Joining the two
 * blindly produces `C:\Users\me\repo/src/app.ts`, which is not what anyone
 * wants back out of the clipboard.
 */
export function absolutePathIn(repoRoot: string | null | undefined, relative: string): string {
  if (!repoRoot) return relative;

  const windows = repoRoot.includes('\\') && !repoRoot.includes('/');
  const separator = windows ? '\\' : '/';
  const root = repoRoot.replace(/[\\/]+$/, '');
  const tail = windows ? relative.replace(/\//g, '\\') : relative;
  return `${root}${separator}${tail}`;
}
