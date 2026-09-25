import { describe, it, expect } from 'vitest';
import { isAllowedDownloadUrl } from '../../electron/update/assets';

// The updater never fetches a URL just because the GitHub API handed it over,
// so this allowlist is the one thing standing between a spoofed response and
// an installer downloaded from somewhere else entirely.
describe('isAllowedDownloadUrl', () => {
  it('allows the download URLs releases of this project actually have', () => {
    for (const url of [
      'https://github.com/MykhailoBovtriuk/git-desktop/releases/download/v1.1.0/Git-Desktop-arm64.dmg',
      'https://github.com/MykhailoBovtriuk/git-desktop/releases/download/v1.0.2/git-desktop-amd64.deb',
    ]) {
      expect(isAllowedDownloadUrl(url), url).toBe(true);
    }
  });

  it('rejects lookalike hosts', () => {
    for (const url of [
      'https://github.com.evil.com/MykhailoBovtriuk/git-desktop/releases/download/v1.1.0/x.dmg',
      'https://evil.com/https://github.com/MykhailoBovtriuk/git-desktop/releases/download/v1.1.0/x.dmg',
    ]) {
      expect(isAllowedDownloadUrl(url), url).toBe(false);
    }
  });

  it('rejects other repositories and other paths on github.com', () => {
    for (const url of [
      'https://github.com/someone-else/git-desktop/releases/download/v1.1.0/x.dmg',
      'https://github.com/MykhailoBovtriuk/git-desktop-evil/releases/download/v1.1.0/x.dmg',
      'https://github.com/MykhailoBovtriuk/git-desktop/issues',
      'https://github.com/MykhailoBovtriuk/git-desktop/releases/latest',
    ]) {
      expect(isAllowedDownloadUrl(url), url).toBe(false);
    }
  });

  it('rejects non-https schemes and junk', () => {
    for (const url of [
      'http://github.com/MykhailoBovtriuk/git-desktop/releases/download/v1.1.0/x.dmg',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'not a url',
      '',
    ]) {
      expect(isAllowedDownloadUrl(url), url).toBe(false);
    }
  });
});
