/**
 * Joins class names without resolving Tailwind conflicts: override padding or
 * sizing via a prop, never `className`.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
