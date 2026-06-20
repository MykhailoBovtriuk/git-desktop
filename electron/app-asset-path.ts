import path from 'path';

export type AppAssetResolution =
  | { ok: true; filePath: string }
  | { ok: false; reason: 'forbidden' };

/**
 * Resolve an `app://` request URL to an absolute path inside `distRoot`,
 * rejecting anything that escapes the root (path traversal, absolute paths).
 *
 * Pure function with no Electron/fs dependency so it can be unit-tested.
 */
export function resolveAppAssetPath(distRoot: string, requestUrl: string): AppAssetResolution {
  const root = path.resolve(distRoot);

  let relativePath: string;
  try {
    const url = new URL(requestUrl);
    relativePath = decodeURIComponent(url.pathname.replace(/^\//, '')) || 'index.html';
  } catch {
    return { ok: false, reason: 'forbidden' };
  }

  if (path.isAbsolute(relativePath)) {
    return { ok: false, reason: 'forbidden' };
  }

  const filePath = path.resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    return { ok: false, reason: 'forbidden' };
  }

  return { ok: true, filePath };
}
