import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // jsdom is opted into per-file via `// @vitest-environment jsdom`
    // docblocks in component tests (environmentMatchGlobs was removed in
    // Vitest 4 and silently did nothing here).
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'electron/**/*.ts'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'electron/main.ts', 'electron/preload.ts'],
      thresholds: {
        // Ratchet: set just under current coverage — raise as it grows,
        // never lower. (As of 2026-09: L 66.3 / S 63.2 / B 61.0 / F 51.3.)
        lines: 65,
        statements: 62,
        branches: 60,
        functions: 50,
      },
    },
  },
});
