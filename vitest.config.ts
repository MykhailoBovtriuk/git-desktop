import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    environmentMatchGlobs: [
      ['**/tests/shared/ui/**/*.test.tsx', 'jsdom'],
    ],
  },
});
