/**
 * Joins class names without resolving Tailwind conflicts: stylesheet order
 * decides which of `py-1 py-1.5` wins, not argument order. Never override a
 * component's padding or sizing via `className`; add a prop instead.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
