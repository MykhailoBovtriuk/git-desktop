import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UpdateInfo } from '../../src/types';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>(),
  appState: { isPackaged: true },
  quit: vi.fn(),
  send: vi.fn(),
  lookupReleases: vi.fn(),
  downloadFile: vi.fn(),
  launchInstaller: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => Promise<unknown>) =>
      mocks.handlers.set(channel, fn),
  },
  app: {
    getVersion: () => '1.1.0',
    getPath: (name: string) => `/tmp/${name}`,
    quit: mocks.quit,
    get isPackaged() {
      return mocks.appState.isPackaged;
    },
  },
  shell: { openPath: vi.fn(), showItemInFolder: vi.fn() },
  BrowserWindow: class {},
}));

vi.mock('../../electron/update/github', () => ({
  lookupReleases: (...args: unknown[]) => mocks.lookupReleases(...args),
}));

vi.mock('../../electron/update/download', async () => {
  const actual = await vi.importActual<typeof import('../../electron/update/download')>(
    '../../electron/update/download',
  );
  return { ...actual, downloadFile: (...args: unknown[]) => mocks.downloadFile(...args) };
});

vi.mock('../../electron/update/install', () => ({
  launchInstaller: (...args: unknown[]) => mocks.launchInstaller(...args),
}));

const { registerUpdateHandlers, resetUpdateState } = await import('../../electron/ipc/update');

const window = { isDestroyed: () => false, webContents: { send: mocks.send } };

const info = (version: string, assetName: string | null = 'Git-Desktop-arm64.dmg'): UpdateInfo => ({
  version,
  tag: `v${version}`,
  notes: '',
  publishedAt: null,
  releaseUrl: `https://github.com/MykhailoBovtriuk/git-desktop/releases/tag/v${version}`,
  assetName,
  assetSize: 100,
  prerelease: false,
});

const call = (channel: string, ...args: unknown[]) => {
  const handler = mocks.handlers.get(channel);
  if (!handler) throw new Error(`${channel} was never registered`);
  return handler({}, ...args) as Promise<{ data?: unknown; error?: string }>;
};

beforeEach(() => {
  mocks.handlers.clear();
  vi.clearAllMocks();
  mocks.appState.isPackaged = true;
  mocks.lookupReleases.mockResolvedValue({
    latest: info('1.2.0'),
    current: info('1.1.0'),
    checkedAt: 1_700_000_000_000,
  });
  mocks.downloadFile.mockResolvedValue(undefined);
  resetUpdateState();
  registerUpdateHandlers({ getWindow: () => window as never });
});

describe('app:check-for-update', () => {
  it('reports an update when the newest release is ahead of this build', async () => {
    const { data } = await call('app:check-for-update', false, false);
    expect(data).toMatchObject({ status: 'available', currentVersion: '1.1.0', canInstall: true });
  });

  it('reports up to date when the newest release is the running one', async () => {
    mocks.lookupReleases.mockResolvedValue({
      latest: info('1.1.0'),
      current: info('1.1.0'),
      checkedAt: 1,
    });
    const { data } = await call('app:check-for-update', false, false);
    expect(data).toMatchObject({ status: 'up-to-date' });
  });

  // Every reload would otherwise spend one of sixty hourly requests.
  it('skips the network in a dev run unless the check was asked for', async () => {
    mocks.appState.isPackaged = false;

    const { data } = await call('app:check-for-update', false, false);

    expect(data).toMatchObject({ status: 'skipped', canInstall: false, latest: null });
    expect(mocks.lookupReleases).not.toHaveBeenCalled();
  });

  it('runs a forced check in a dev run, but says it cannot install', async () => {
    mocks.appState.isPackaged = false;

    const { data } = await call('app:check-for-update', false, true);

    expect(mocks.lookupReleases).toHaveBeenCalled();
    expect(data).toMatchObject({ status: 'available', canInstall: false });
  });
});

describe('app:download-update', () => {
  it('refuses anything that is not a version', async () => {
    for (const bad of ['; rm -rf /', 42, '', '../../etc/passwd', 'latest']) {
      const { error } = await call('app:download-update', bad);
      expect(error, String(bad)).toMatch(/Invalid argument: version/);
    }
    expect(mocks.downloadFile).not.toHaveBeenCalled();
  });

  it('downloads the asset of the named release and reports where it landed', async () => {
    mocks.downloadFile.mockImplementation(
      async (req: { onProgress: (r: number, t: number, s: number) => void }) => {
        req.onProgress(50, 100, 1_000);
      },
    );

    const { data } = await call('app:download-update', '1.2.0');

    expect(mocks.downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/MykhailoBovtriuk/git-desktop/releases/download/v1.2.0/Git-Desktop-arm64.dmg',
        expectedSize: 100,
      }),
    );
    expect(data).toEqual({
      version: '1.2.0',
      filePath: '/tmp/downloads/Git-Desktop-arm64-1.2.0.dmg',
    });
    expect(mocks.send).toHaveBeenCalledWith('app:update-progress', {
      version: '1.2.0',
      receivedBytes: 50,
      totalBytes: 100,
      percent: 50,
      bytesPerSecond: 1_000,
    });
  });

  it('refuses a release nothing is built for on this machine', async () => {
    mocks.lookupReleases.mockResolvedValue({
      latest: info('1.2.0', null),
      current: null,
      checkedAt: 1,
    });

    const { error } = await call('app:download-update', '1.2.0');

    expect(error).toBe('no-asset');
    expect(mocks.downloadFile).not.toHaveBeenCalled();
  });

  it('refuses a version no release matches', async () => {
    const { error } = await call('app:download-update', '9.9.9');
    expect(error).toBe('no-release');
  });

  // A dev session must never launch an installer over the real install.
  it('refuses to download from a dev run', async () => {
    mocks.appState.isPackaged = false;
    const { error } = await call('app:download-update', '1.2.0');
    expect(error).toBe('dev-build');
  });
});

describe('app:install-update and app:cancel-update-download', () => {
  it('has nothing to install until something was downloaded', async () => {
    const { error } = await call('app:install-update');
    expect(error).toBe('no-download');
    expect(mocks.launchInstaller).not.toHaveBeenCalled();
  });

  // The path comes from the main process own state: taking one from the
  // renderer would be a way to open any file on the machine.
  it('installs the file it downloaded itself', async () => {
    await call('app:download-update', '1.2.0');

    const { error } = await call('app:install-update');

    expect(error).toBeUndefined();
    expect(mocks.launchInstaller).toHaveBeenCalledWith('/tmp/downloads/Git-Desktop-arm64-1.2.0.dmg');
  });

  it('treats cancelling nothing as a no-op, not a failure', async () => {
    const { data, error } = await call('app:cancel-update-download');
    expect(error).toBeUndefined();
    expect(data).toBeNull();
  });
});
