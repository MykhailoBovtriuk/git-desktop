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
        // never lower. (As of 2026-07: L 61.6 / S 58.9 / B 57.6 / F 42.3.)
        lines: 60,
        statements: 57,
        branches: 55,
        functions: 40,
      },
    },
  },
});
