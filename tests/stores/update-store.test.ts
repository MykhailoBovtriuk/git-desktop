import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUpdateStore } from '../../src/stores/update-store';
import { useSettingsStore } from '../../src/stores/settings-store';
import { updateApi } from '../../src/api/update-api';
import type { UpdateCheckResult, UpdateInfo } from '../../src/types';

vi.mock('../../src/api/update-api', () => ({
  updateApi: {
    check: vi.fn(),
    download: vi.fn(),
    cancelDownload: vi.fn(),
    install: vi.fn(),
    onProgress: vi.fn(),
  },
}));

const busy = { busyOperation: null as string | null };
vi.mock('../../src/stores/repo-store', () => ({
  useRepoStore: { getState: () => busy },
}));

const info = (version: string): UpdateInfo => ({
  version,
  tag: `v${version}`,
  notes: 'what changed',
  publishedAt: null,
  releaseUrl: `https://github.com/MykhailoBovtriuk/git-desktop/releases/tag/v${version}`,
  assetName: 'Git-Desktop-arm64.dmg',
  assetSize: 140_906_445,
  prerelease: false,
});

const result = (overrides: Partial<UpdateCheckResult> = {}): UpdateCheckResult => ({
  status: 'available',
  currentVersion: '1.1.0',
  latest: info('1.2.0'),
  current: info('1.1.0'),
  canInstall: true,
  checkedAt: 1,
  ...overrides,
});

const INITIAL = useUpdateStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  busy.busyOperation = null;
  useUpdateStore.setState({
    ...INITIAL,
    phase: 'idle',
    result: null,
    progress: null,
    downloadedVersion: null,
    error: null,
    modalOpen: false,
    cancelRequested: false,
  });
  useSettingsStore.setState({ skippedVersion: null, includePrereleases: false });
});

describe('check', () => {
  it('opens the modal when a newer release turns up', async () => {
    vi.mocked(updateApi.check).mockResolvedValue(result());

    await useUpdateStore.getState().check({ silent: true });

    expect(useUpdateStore.getState().phase).toBe('available');
    expect(useUpdateStore.getState().modalOpen).toBe(true);
  });

  it('stays quiet about a version the user skipped', async () => {
    useSettingsStore.setState({ skippedVersion: '1.2.0' });
    vi.mocked(updateApi.check).mockResolvedValue(result());

    await useUpdateStore.getState().check({ silent: true });

    expect(useUpdateStore.getState().phase).toBe('available');
    expect(useUpdateStore.getState().modalOpen).toBe(false);
  });

  it('un-skips when the user asks for a check themselves', async () => {
    useSettingsStore.setState({ skippedVersion: '1.2.0' });
    vi.mocked(updateApi.check).mockResolvedValue(result());

    await useUpdateStore.getState().check({ force: true });

    expect(useSettingsStore.getState().skippedVersion).toBeNull();
    expect(useUpdateStore.getState().modalOpen).toBe(true);
  });

  it('passes the pre-release preference through', async () => {
    useSettingsStore.setState({ includePrereleases: true });
    vi.mocked(updateApi.check).mockResolvedValue(result({ status: 'up-to-date', latest: null }));

    await useUpdateStore.getState().check({ force: true });

    expect(updateApi.check).toHaveBeenCalledWith(true, true);
    expect(useUpdateStore.getState().phase).toBe('idle');
  });

  // Nobody asked; the network being down is not news worth a red banner.
  it('swallows a failed startup check', async () => {
    vi.mocked(updateApi.check).mockRejectedValue(new Error('offline'));

    await useUpdateStore.getState().check({ silent: true });

    expect(useUpdateStore.getState().phase).toBe('idle');
    expect(useUpdateStore.getState().error).toBeNull();
  });

  it('keeps the error of a check the user asked for', async () => {
    vi.mocked(updateApi.check).mockRejectedValue(new Error('rate-limited'));

    await useUpdateStore.getState().check({ force: true });

    expect(useUpdateStore.getState().phase).toBe('error');
    expect(useUpdateStore.getState().error).toBe('rate-limited');
  });
});

describe('download', () => {
  it('runs from downloading to ready, carrying progress', async () => {
    vi.mocked(updateApi.download).mockResolvedValue({ version: '1.2.0', filePath: '/tmp/x.dmg' });

    const running = useUpdateStore.getState().startDownload('1.2.0');
    expect(useUpdateStore.getState().phase).toBe('downloading');

    useUpdateStore.getState().setProgress({
      version: '1.2.0',
      receivedBytes: 50,
      totalBytes: 100,
      percent: 50,
      bytesPerSecond: 1_000,
    });
    expect(useUpdateStore.getState().progress?.percent).toBe(50);

    await running;
    expect(useUpdateStore.getState().phase).toBe('ready');
    expect(useUpdateStore.getState().downloadedVersion).toBe('1.2.0');
  });

  it('treats a cancelled download as a step back, not a failure', async () => {
    useUpdateStore.setState({ result: result() });
    vi.mocked(updateApi.cancelDownload).mockResolvedValue(null);
    vi.mocked(updateApi.download).mockImplementation(async () => {
      await useUpdateStore.getState().cancelDownload();
      throw new Error('Update download cancelled');
    });

    await useUpdateStore.getState().startDownload('1.2.0');

    expect(useUpdateStore.getState().phase).toBe('available');
    expect(useUpdateStore.getState().error).toBeNull();
  });

  it('keeps a real download failure', async () => {
    vi.mocked(updateApi.download).mockRejectedValue(new Error('no-asset'));

    await useUpdateStore.getState().startDownload('1.2.0');

    expect(useUpdateStore.getState().phase).toBe('error');
    expect(useUpdateStore.getState().error).toBe('no-asset');
  });
});

describe('install', () => {
  it('refuses to quit in the middle of a git operation', async () => {
    busy.busyOperation = 'push';

    await useUpdateStore.getState().install();

    expect(updateApi.install).not.toHaveBeenCalled();
    expect(useUpdateStore.getState().error).toBe('repo-busy');
  });

  it('hands over to the main process when nothing is running', async () => {
    vi.mocked(updateApi.install).mockResolvedValue(null);

    await useUpdateStore.getState().install();

    expect(updateApi.install).toHaveBeenCalled();
    expect(useUpdateStore.getState().error).toBeNull();
  });
});

describe('dismissing', () => {
  it('later closes the modal and keeps the finding', async () => {
    useUpdateStore.setState({ result: result(), modalOpen: true });

    useUpdateStore.getState().later();

    expect(useUpdateStore.getState().modalOpen).toBe(false);
    expect(useUpdateStore.getState().result).not.toBeNull();
    expect(useSettingsStore.getState().skippedVersion).toBeNull();
  });

  it('skip remembers the version so the next launch stays quiet', () => {
    useUpdateStore.setState({ result: result(), modalOpen: true });

    useUpdateStore.getState().skip();

    expect(useSettingsStore.getState().skippedVersion).toBe('1.2.0');
    expect(useUpdateStore.getState().modalOpen).toBe(false);
  });
});
