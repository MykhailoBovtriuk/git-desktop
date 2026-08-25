import { describe, it, expect, vi } from 'vitest';

// The module pulls in electron only for its handlers; the allowlist itself is
// pure, so a stub is enough to import it.
vi.mock('electron', () => ({
  app: { getVersion: () => '0.0.0' },
  ipcMain: { handle: vi.fn() },
  shell: { openExternal: vi.fn() },
  BrowserWindow: class {},
}));

const { isAllowedExternalUrl } = await import('../../electron/ipc/app');

describe('isAllowedExternalUrl', () => {
  it('allows the project pages it is meant to open', () => {
    for (const url of [
      'https://github.com/MykhailoBovtriuk/git-desktop',
      'https://github.com/MykhailoBovtriuk/git-desktop/issues',
      'https://github.com/MykhailoBovtriuk/git-desktop/releases',
      'https://github.com/sponsors/MykhailoBovtriuk',
      'https://docs.github.com/en/authentication/connecting-to-github-with-ssh',
    ]) {
      expect(isAllowedExternalUrl(url), url).toBe(true);
    }
  });

  // Adding a second origin is exactly where an allowlist springs a leak, so
  // pin the lookalikes down.
  it('rejects lookalike hosts that merely start with an allowed one', () => {
    for (const url of [
      'https://docs.github.com.evil.com/en/authentication',
      'https://github.com.evil.com/MykhailoBovtriuk/git-desktop',
      'https://evil.com/https://github.com/MykhailoBovtriuk/git-desktop',
    ]) {
      expect(isAllowedExternalUrl(url), url).toBe(false);
    }
  });

  it('rejects paths that merely start with an allowed prefix', () => {
    expect(isAllowedExternalUrl('https://github.com/MykhailoBovtriuk/git-desktop-evil')).toBe(
      false,
    );
    expect(isAllowedExternalUrl('https://docs.github.com/en/authentication-evil')).toBe(false);
  });

  it('rejects other paths on an allowed origin', () => {
    expect(isAllowedExternalUrl('https://github.com/someone-else/repo')).toBe(false);
    expect(isAllowedExternalUrl('https://docs.github.com/en/billing')).toBe(false);
  });

  it('rejects non-https schemes and junk', () => {
    for (const url of [
      'http://github.com/MykhailoBovtriuk/git-desktop',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'not a url',
      '',
    ]) {
      expect(isAllowedExternalUrl(url), url).toBe(false);
    }
  });
});
