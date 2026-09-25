/**
 * Which release asset belongs to the machine this copy is running on.
 *
 * The names below mirror the `artifactName` templates in
 * `electron-builder.yml`, which deliberately carry no version number. That
 * coupling is the price of stable download URLs; an unknown combination
 * resolves to `null` so the UI falls back to the release page instead of
 * guessing at a file that may not exist.
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
 * Whether this Linux copy came out of the AppImage or out of the .deb.
 *
 * The AppImage runtime exports APPIMAGE (the absolute path to the image
 * itself) and APPDIR, and mounts the payload under /tmp/.mount_XXXXXX — the
 * execPath check catches a launcher that cleared the environment. Everything
 * else is dpkg's /opt install. Guessing wrong only means the wrong file is
 * revealed in a folder, since neither format installs itself.
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
 * Where a download may come from.
 *
 * `browser_download_url` arrives from the network, so it is checked against
 * the one prefix releases of this project can live at before a byte is
 * fetched — and the file it lands under is named from the table above, never
 * from the API's own `name`, so no response can steer a write elsewhere.
 * GitHub redirects the download to its object storage; only the entry point is
 * pinned, because that is the part a spoofed response could choose.
 */
const DOWNLOAD_PREFIX = 'https://github.com/MykhailoBovtriuk/git-desktop/releases/download/';

/**
 * The URL an asset of a given release lives at.
 *
 * Built here rather than taken from the API response: the tag is already known
 * to be a version and the name comes from the table above, so the result is
 * allowed by construction.
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
