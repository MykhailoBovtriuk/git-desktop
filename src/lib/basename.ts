/**
 * Return the final segment of a filesystem path, accepting either POSIX (`/`)
 * or Windows (`\`) separators (or a mix). Trailing separators are ignored.
 * Falls back to the original value when there is no separator.
 *
 * Renderer-side helper: repo/file paths reach the UI as raw strings, so a plain
 * `split('/')` mangles `D:\repo\project` on Windows.
 */
export function basenameFromPath(value: string): string {
  const segments = value.split(/[\\/]/).filter(Boolean);
  return segments.length ? segments[segments.length - 1] : value;
}
