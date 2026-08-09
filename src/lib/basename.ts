export function basenameFromPath(value: string): string {
  const segments = value.split(/[\\/]/).filter(Boolean);
  return segments.length ? segments[segments.length - 1] : value;
}
