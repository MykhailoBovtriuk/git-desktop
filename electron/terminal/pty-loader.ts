import type * as NodePty from 'node-pty';

export type PtyModule = typeof NodePty;

let cached: { pty: PtyModule | null; reason?: string } | null = null;

/**
 * node-pty is native and has no prebuild for every target; a missing or broken
 * binary must cost the terminal, not the app. Loaded on first use, once.
 */
export function loadPty(): { pty: PtyModule | null; reason?: string } {
  if (!cached) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = { pty: require('node-pty') as PtyModule };
    } catch (err: unknown) {
      cached = { pty: null, reason: err instanceof Error ? err.message : String(err) };
    }
  }
  return cached;
}
