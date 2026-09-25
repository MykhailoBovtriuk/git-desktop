import { describe, it, expect } from 'vitest';
import { assetNameFor, linuxPackageFormat } from '../../electron/update/assets';

describe('assetNameFor', () => {
  // These are the asset names of a real release; they come from the
  // `artifactName` templates in electron-builder.yml, so this table is the
  // place that breaks first if those are ever edited.
  it('names every artifact the release workflow publishes', () => {
    const cases: [string, string, 'AppImage' | 'deb', string][] = [
      ['darwin', 'x64', 'deb', 'Git-Desktop-x64.dmg'],
      ['darwin', 'arm64', 'deb', 'Git-Desktop-arm64.dmg'],
      ['win32', 'x64', 'deb', 'Git-Desktop-Setup-x64.exe'],
      ['win32', 'arm64', 'deb', 'Git-Desktop-Setup-arm64.exe'],
      ['win32', 'ia32', 'deb', 'Git-Desktop-Setup-ia32.exe'],
      ['linux', 'x64', 'AppImage', 'git-desktop-x86_64.AppImage'],
      ['linux', 'arm64', 'AppImage', 'git-desktop-arm64.AppImage'],
      ['linux', 'x64', 'deb', 'git-desktop-amd64.deb'],
      ['linux', 'arm64', 'deb', 'git-desktop-arm64.deb'],
    ];
    for (const [platform, arch, pkg, expected] of cases) {
      expect(assetNameFor(platform, arch, pkg), `${platform}|${arch}|${pkg}`).toBe(expected);
    }
  });

  // No build exists for these, so the UI has to fall back to the release page
  // rather than download a name nobody published.
  it('returns null for combinations nothing is built for', () => {
    expect(assetNameFor('linux', 'ia32', 'deb')).toBeNull();
    expect(assetNameFor('freebsd', 'x64', 'deb')).toBeNull();
    expect(assetNameFor('darwin', 'ia32', 'deb')).toBeNull();
    expect(assetNameFor('', '', 'deb')).toBeNull();
  });
});

describe('linuxPackageFormat', () => {
  it('recognises an AppImage by the variables its runtime exports', () => {
    expect(linuxPackageFormat({ APPIMAGE: '/home/me/git-desktop.AppImage' }, '/tmp/x')).toBe(
      'AppImage',
    );
    expect(linuxPackageFormat({ APPDIR: '/tmp/.mount_abc123' }, '/tmp/x')).toBe('AppImage');
  });

  it('recognises an AppImage by its mount point when the environment is bare', () => {
    expect(linuxPackageFormat({}, '/tmp/.mount_gitdeAbCdEf/git-desktop')).toBe('AppImage');
  });

  it('treats everything else as the dpkg install', () => {
    expect(linuxPackageFormat({}, '/opt/Git Desktop/git-desktop')).toBe('deb');
    expect(linuxPackageFormat({}, '/usr/bin/git-desktop')).toBe('deb');
  });
});
