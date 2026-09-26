// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateSection } from '../../../src/components/settings/UpdateSection';
import { useUpdateStore } from '../../../src/stores/update-store';
import { useSettingsStore } from '../../../src/stores/settings-store';
import type { UpdateCheckResult, UpdateInfo, UpdatePhase } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/update-store', () => ({ useUpdateStore: vi.fn() }));
vi.mock('../../../src/stores/settings-store', () => ({ useSettingsStore: vi.fn() }));
vi.mock('../../../src/api/app-api', () => ({
  appApi: {
    getVersion: vi.fn().mockResolvedValue('1.1.0'),
    openExternal: vi.fn().mockResolvedValue(null),
  },
}));

const release = (version: string): UpdateInfo => ({
  version,
  tag: `v${version}`,
  notes: '',
  publishedAt: null,
  releaseUrl: `https://github.com/MykhailoBovtriuk/git-desktop/releases/tag/v${version}`,
  assetName: 'Git-Desktop-arm64.dmg',
  assetSize: 1,
  prerelease: false,
});

function setup({
  phase = 'idle' as UpdatePhase,
  result = null as UpdateCheckResult | null,
  error = null as string | null,
  autoCheckUpdates = true,
  includePrereleases = false,
} = {}) {
  window.electronAPI = { platform: 'darwin' } as typeof window.electronAPI;
  const update = {
    check: vi.fn().mockResolvedValue(undefined),
    startDownload: vi.fn().mockResolvedValue(undefined),
    cancelDownload: vi.fn().mockResolvedValue(undefined),
    install: vi.fn().mockResolvedValue(undefined),
  };
  const settings = {
    setAutoCheckUpdates: vi.fn(),
    setIncludePrereleases: vi.fn(),
  };
  const updateState = {
    phase,
    result,
    progress: null,
    downloadedVersion: phase === 'ready' ? '1.2.0' : null,
    error,
    ...update,
  };
  const settingsState = { autoCheckUpdates, includePrereleases, ...settings };
  vi.mocked(useUpdateStore).mockImplementation(((sel: any) => sel(updateState)) as any);
  vi.mocked(useSettingsStore).mockImplementation(((sel: any) => sel(settingsState)) as any);
  return { ...update, ...settings };
}

const checked: UpdateCheckResult = {
  status: 'up-to-date',
  currentVersion: '1.1.0',
  latest: release('1.1.0'),
  current: release('1.1.0'),
  canInstall: true,
  checkedAt: 0,
};

describe('UpdateSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('checks explicitly, forcing past the cache', () => {
    const { check } = setup();
    render(<UpdateSection />);
    fireEvent.click(screen.getByText('check'));
    expect(check).toHaveBeenCalledWith({ force: true });
  });

  it('keeps the button disabled while a check runs', () => {
    setup({ phase: 'checking' });
    render(<UpdateSection />);
    expect((screen.getByText('check') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('checking')).toBeTruthy();
  });

  it('says so when up to date', () => {
    setup({ result: checked });
    render(<UpdateSection />);
    expect(screen.getByText('upToDate')).toBeTruthy();
  });

  it('turns the button into Update when a release is available', () => {
    const { startDownload } = setup({
      phase: 'available',
      result: { ...checked, status: 'available', latest: release('1.2.0') },
    });
    render(<UpdateSection />);
    fireEvent.click(screen.getByText('update'));
    expect(startDownload).toHaveBeenCalledWith('1.2.0');
  });

  it('turns it into Install once downloaded', () => {
    const { install } = setup({ phase: 'ready', result: checked });
    render(<UpdateSection />);
    fireEvent.click(screen.getByText('install'));
    expect(install).toHaveBeenCalled();
  });

  it('reinstalls the running version', () => {
    const { startDownload } = setup({ result: checked });
    render(<UpdateSection />);
    fireEvent.click(screen.getByText('reinstall'));
    expect(startDownload).toHaveBeenCalledWith('1.1.0');
  });

  // Between a version bump and its release there is nothing to reinstall.
  it('disables reinstall when no release matches the running version', () => {
    setup({ result: { ...checked, current: null } });
    render(<UpdateSection />);
    expect((screen.getByText('reinstall') as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables reinstall in a build that cannot install', () => {
    setup({ result: { ...checked, canInstall: false } });
    render(<UpdateSection />);
    expect((screen.getByText('reinstall') as HTMLButtonElement).disabled).toBe(true);
  });

  it('toggles both preferences', () => {
    const { setAutoCheckUpdates, setIncludePrereleases } = setup();
    render(<UpdateSection />);
    fireEvent.click(screen.getByText('autoCheck'));
    expect(setAutoCheckUpdates).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByText('includePrerelease'));
    expect(setIncludePrereleases).toHaveBeenCalledWith(true);
  });

  it('shows the last error translated', () => {
    setup({ phase: 'error', error: 'offline' });
    render(<UpdateSection />);
    expect(screen.getByText('errors.offline')).toBeTruthy();
  });
});
