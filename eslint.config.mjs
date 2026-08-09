import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist/**', 'dist-electron/**', 'release/**', 'node_modules/**', 'coverage/**'] },
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // The codebase deliberately uses the classic fetch-in-effect pattern
      // (setLoading(true) → await → setState). Migrating to derived state /
      // suspense is a separate refactor, not a lint fix.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    rules: {
      // The IPC boundary and store mocks legitimately deal in `unknown`
      // shapes; explicit `any` remains visible in review either way.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
