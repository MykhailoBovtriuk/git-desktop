/**
 * Which release asset fits this machine. Names mirror the `artifactName`
 * templates in electron-builder.yml; unknown combos yield null.
 */
export type LinuxPackage = 'AppImage' | 'deb';

const ASSETS: Record<string, string> = {
  'darwin|x64': 'Git-Desktop-x64.dmg',
  'darwin|arm64': 'Git-Desktop-arm64.dmg',
  'win32|x64': 'Git-Desktop-Setup-x64.exe',
  'win32|arm64': 'Git-Desktop-Setup-arm64.exe',
  'win32|ia32': 'Git-Desktop-Setup-ia32.exe',
  // The two spellings of x64 are electron-builder's, not ours: it expands
  // `${arch}` per target, and AppImage and dpkg disagree about the name.
  'linux|x64|AppImage': 'git-desktop-x86_64.AppImage',
  'linux|arm64|AppImage': 'git-desktop-arm64.AppImage',
  'linux|x64|deb': 'git-desktop-amd64.deb',
  'linux|arm64|deb': 'git-desktop-arm64.deb',
};

export function assetNameFor(
  platform: string,
  arch: string,
  linuxPackage: LinuxPackage,
): string | null {
  const key = platform === 'linux' ? `linux|${arch}|${linuxPackage}` : `${platform}|${arch}`;
  return ASSETS[key] ?? null;
}

/**
 * Whether this Linux copy is the AppImage or the .deb, judged by
 * APPIMAGE/APPDIR and the execPath.
 */
export function linuxPackageFormat(
  env: NodeJS.ProcessEnv = process.env,
  execPath: string = process.execPath,
): LinuxPackage {
  if (env.APPIMAGE || env.APPDIR) return 'AppImage';
  if (execPath.startsWith('/tmp/.mount_')) return 'AppImage';
  return 'deb';
}

/**
 * Where a download may come from: `browser_download_url` must match this
 * prefix, and the file name comes from our table, never from the API.
 */
const DOWNLOAD_PREFIX = 'https://github.com/MykhailoBovtriuk/git-desktop/releases/download/';

/**
 * An asset's URL, built from a validated tag and a name from the table rather
 * than taken from the API response.
 */
export function downloadUrlFor(tag: string, assetName: string): string {
  return `${DOWNLOAD_PREFIX}${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`;
}

export function isAllowedDownloadUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.origin !== 'https://github.com') return false;
  return url.href.startsWith(DOWNLOAD_PREFIX);
}
