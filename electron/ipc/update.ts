import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { wrap } from './wrap';
import { assertString } from '../ipc-validators';
import { lookupReleases } from '../update/github';
import { downloadUrlFor, linuxPackageFormat } from '../update/assets';
import { downloadFile, versionedFileName } from '../update/download';
import { launchInstaller } from '../update/install';
import { isNewerVersion } from '../update/semver';
import type {
  DownloadedUpdate,
  UpdateCheckResult,
  UpdateInfo,
  UpdateProgress,
} from '../../src/types';

export interface UpdateHandlerOptions {
  getWindow?: () => BrowserWindow | null;
}

/**
 * Failures the UI has its own wording for travel as these tokens.
 *
 * The IPC envelope carries a message and nothing else, so the message is the
 * token; anything not listed here reaches the user as the text it came with.
 */
const DEV_BUILD = 'dev-build';
const NO_RELEASE = 'no-release';
const NO_ASSET = 'no-asset';
const NO_DOWNLOAD = 'no-download';
const BUSY = 'download-in-progress';

function assertVersion(value: unknown): asserts value is string {
  assertString(value, 'version');
  // The version picks a release and ends up in a URL and a file name, so it is
  // held to the shape of a version rather than merely to being a string.
  if (!/^\d+\.\d+\.\d+(-[0-9a-z.-]+)?$/i.test(value as string)) {
    throw new Error('Invalid argument: version is not a version');
  }
}

let notifyProgress: (progress: UpdateProgress) => void = () => {};
let active: { controller: AbortController; version: string } | null = null;
/** What the install handler acts on: a path from the renderer would be a way
 * to open any file on the machine. */
let lastDownload: DownloadedUpdate | null = null;

/** Tests only; the state above deliberately outlives a single call. */
export function resetUpdateState(): void {
  active = null;
  lastDownload = null;
}

function machine() {
  return {
    platform: process.platform,
    arch: process.arch,
    linuxPackage: linuxPackageFormat(),
  };
}

function downloadsDir(): string {
  try {
    return app.getPath('downloads');
  } catch {
    return app.getPath('temp');
  }
}

async function checkForUpdate(
  includePrerelease: boolean,
  force: boolean,
): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion();
  const canInstall = app.isPackaged;

  // A dev run would spend one of sixty hourly requests on every reload, and
  // has nothing to install onto anyway.
  if (!canInstall && !force) {
    return {
      status: 'skipped',
      currentVersion,
      latest: null,
      current: null,
      canInstall,
      checkedAt: Date.now(),
    };
  }

  const lookup = await lookupReleases({
    currentVersion,
    includePrerelease,
    force,
    ...machine(),
  });

  const available = lookup.latest
    ? isNewerVersion(lookup.latest.version, currentVersion)
    : false;

  return {
    status: available ? 'available' : 'up-to-date',
    currentVersion,
    latest: lookup.latest,
    current: lookup.current,
    canInstall,
    checkedAt: lookup.checkedAt,
  };
}

/** Both the update and the reinstall button come through here — reinstalling
 * is downloading the release whose tag matches the running version. */
async function releaseFor(version: string): Promise<UpdateInfo> {
  const lookup = await lookupReleases({
    currentVersion: app.getVersion(),
    // The version was named explicitly, so a pre-release is no surprise here.
    includePrerelease: true,
    force: false,
    ...machine(),
  });

  const info = [lookup.latest, lookup.current].find(
    candidate => candidate?.version === version,
  );
  if (!info) throw new Error(NO_RELEASE);
  if (!info.assetName) throw new Error(NO_ASSET);
  return info;
}

async function startDownload(version: unknown): Promise<DownloadedUpdate> {
  assertVersion(version);
  if (!app.isPackaged) throw new Error(DEV_BUILD);
  if (active) throw new Error(BUSY);

  const info = await releaseFor(version);
  const assetName = info.assetName as string;
  const targetPath = path.join(downloadsDir(), versionedFileName(assetName, info.version));
  const controller = new AbortController();
  active = { controller, version: info.version };

  try {
    await downloadFile({
      url: downloadUrlFor(info.tag, assetName),
      expectedSize: info.assetSize,
      targetPath,
      signal: controller.signal,
      onProgress: (receivedBytes, totalBytes, bytesPerSecond) =>
        notifyProgress({
          version: info.version,
          receivedBytes,
          totalBytes,
          percent: totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : 0,
          bytesPerSecond: Math.round(bytesPerSecond),
        }),
    });
  } finally {
    active = null;
  }

  lastDownload = { version: info.version, filePath: targetPath };
  return lastDownload;
}

export function registerUpdateHandlers(options: UpdateHandlerOptions = {}) {
  // A download outlives the window that started it: a reload must not crash
  // the send, and must not stop the download either.
  notifyProgress = progress => {
    const win = options.getWindow?.() ?? null;
    if (win && !win.isDestroyed()) win.webContents.send('app:update-progress', progress);
  };

  ipcMain.handle('app:check-for-update', (_e, includePrerelease: unknown, force: unknown) =>
    wrap(() => checkForUpdate(includePrerelease === true, force === true)),
  );

  ipcMain.handle('app:download-update', (_e, version: unknown) => wrap(() => startDownload(version)));

  ipcMain.handle('app:cancel-update-download', () =>
    wrap(async () => {
      // Cancelling a download that already finished is not an error, it is a
      // race the user won by a second.
      active?.controller.abort();
      return null;
    }),
  );

  ipcMain.handle('app:install-update', () =>
    wrap(async () => {
      if (!lastDownload) throw new Error(NO_DOWNLOAD);
      await launchInstaller(lastDownload.filePath);
      return null;
    }),
  );
}
