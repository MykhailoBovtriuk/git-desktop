import { describe, it, expect } from 'vitest';
import { langForPath, DIFF_THEME } from '../../../src/components/diff/highlight-lang';

describe('langForPath', () => {
  it('maps common source extensions to bundled shiki languages', () => {
    expect(langForPath('src/app.ts')).toBe('typescript');
    expect(langForPath('src/App.tsx')).toBe('tsx');
    expect(langForPath('index.js')).toBe('javascript');
    expect(langForPath('a.jsx')).toBe('jsx');
    expect(langForPath('data.json')).toBe('json');
    expect(langForPath('styles.css')).toBe('css');
    expect(langForPath('main.py')).toBe('python');
    expect(langForPath('main.go')).toBe('go');
    expect(langForPath('lib.rs')).toBe('rust');
    expect(langForPath('README.md')).toBe('markdown');
    expect(langForPath('ci.yml')).toBe('yaml');
    expect(langForPath('run.sh')).toBe('shellscript');
  });

  it('is case-insensitive on the extension', () => {
    expect(langForPath('Component.TSX')).toBe('tsx');
    expect(langForPath('DATA.JSON')).toBe('json');
  });

  it('returns null for unsupported or extension-less paths', () => {
    expect(langForPath('notes.txt')).toBeNull();
    expect(langForPath('binary.bin')).toBeNull();
    expect(langForPath('Makefile')).toBeNull();
    expect(langForPath('.gitignore')).toBe(null); // no real extension segment → 'gitignore'
  });

  it('resolves the extension from the last dot only', () => {
    expect(langForPath('a/b.c/App.test.ts')).toBe('typescript');
  });

  it('exposes the Catppuccin theme name', () => {
    expect(DIFF_THEME).toBe('catppuccin-mocha');
  });
});
