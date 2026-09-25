// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateModal } from '../../../src/components/update/UpdateModal';
import { useUpdateStore } from '../../../src/stores/update-store';
import { appApi } from '../../../src/api/app-api';
import type {
  UpdateCheckResult,
  UpdateInfo,
  UpdatePhase,
  UpdateProgress,
} from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/update-store', () => ({ useUpdateStore: vi.fn() }));
vi.mock('../../../src/api/app-api', () => ({
  appApi: { openExternal: vi.fn().mockResolvedValue(null) },
}));

const release: UpdateInfo = {
  version: '1.2.0',
  tag: 'v1.2.0',
  notes: 'Faster graph',
  publishedAt: null,
  releaseUrl: 'https://github.com/MykhailoBovtriuk/git-desktop/releases/tag/v1.2.0',
  assetName: 'Git-Desktop-arm64.dmg',
  assetSize: 110 * 1024 * 1024,
  prerelease: false,
};

const result = (over: Partial<UpdateCheckResult> = {}): UpdateCheckResult => ({
  status: 'available',
  currentVersion: '1.1.0',
  latest: release,
  current: null,
  canInstall: true,
  checkedAt: 0,
  ...over,
});

function setup({
  modalOpen = true,
  phase = 'available' as UpdatePhase,
  res = result() as UpdateCheckResult | null,
  progress = null as UpdateProgress | null,
  error = null as string | null,
  platform = 'darwin',
} = {}) {
  window.electronAPI = { platform } as typeof window.electronAPI;
  const actions = {
    startDownload: vi.fn().mockResolvedValue(undefined),
    cancelDownload: vi.fn().mockResolvedValue(undefined),
    install: vi.fn().mockResolvedValue(undefined),
    later: vi.fn(),
    skip: vi.fn(),
  };
  const state = {
    modalOpen,
    phase,
    result: res,
    progress,
    downloadedVersion: phase === 'ready' ? '1.2.0' : null,
    error,
    ...actions,
  };
  vi.mocked(useUpdateStore).mockImplementation(((sel: any) => sel(state)) as any);
  return actions;
}

describe('UpdateModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing while closed', () => {
    setup({ modalOpen: false });
    const { container } = render(<UpdateModal />);
    expect(container.innerHTML).toBe('');
  });

  it('offers skip, later and update, with notes and size', () => {
    const { skip, later, startDownload } = setup();
    render(<UpdateModal />);

    expect(screen.getByText('Faster graph')).toBeTruthy();
    expect(screen.getByText('modal.size')).toBeTruthy();

    fireEvent.click(screen.getByText('modal.skip'));
    expect(skip).toHaveBeenCalled();
    fireEvent.click(screen.getByText('modal.later'));
    expect(later).toHaveBeenCalled();
    fireEvent.click(screen.getByText('modal.update'));
    expect(startDownload).toHaveBeenCalledWith('1.2.0');
  });

  // A dev build must never launch an installer over the real app; it still
  // hears about the release, just as a link.
  it('offers the release page when this build cannot install', () => {
    const { startDownload } = setup({ res: result({ canInstall: false }) });
    render(<UpdateModal />);

    expect(screen.queryByText('modal.update')).toBeNull();
    fireEvent.click(screen.getByText('modal.openRelease'));
    expect(appApi.openExternal).toHaveBeenCalledWith(release.releaseUrl);
    expect(startDownload).not.toHaveBeenCalled();
  });

  it('offers the release page when there is no installer for this machine', () => {
    setup({ res: result({ latest: { ...release, assetName: null } }) });
    render(<UpdateModal />);
    expect(screen.getByText('modal.openRelease')).toBeTruthy();
  });

  it('draws progress and lets the download be cancelled', () => {
    const { cancelDownload } = setup({
      phase: 'downloading',
      progress: {
        version: '1.2.0',
        receivedBytes: 50,
        totalBytes: 100,
        percent: 50,
        bytesPerSecond: 0,
      },
    });
    const { container } = render(<UpdateModal />);

    expect(screen.getByText('modal.downloadingTitle')).toBeTruthy();
    expect(screen.getByText('modal.progress')).toBeTruthy();
    expect((container.ownerDocument.querySelector('[style]') as HTMLElement).style.width).toBe(
      '50%',
    );

    fireEvent.click(screen.getByText('common:cancel'));
    expect(cancelDownload).toHaveBeenCalled();
  });

  it.each([
    ['win32', 'modal.readyBodyWin', 'modal.installNow'],
    ['darwin', 'modal.readyBodyMac', 'modal.installNow'],
    ['linux', 'modal.readyBodyLinux', 'reveal'],
  ])('explains what installing does on %s', (platform, body, button) => {
    const { install } = setup({ phase: 'ready', platform });
    render(<UpdateModal />);

    expect(screen.getByText(body)).toBeTruthy();
    fireEvent.click(screen.getByText(button));
    expect(install).toHaveBeenCalled();
  });

  it('translates known error tokens and shows others as they came', () => {
    setup({ phase: 'error', error: 'rate-limited' });
    const { unmount } = render(<UpdateModal />);
    expect(screen.getByText('errors.rateLimited')).toBeTruthy();
    unmount();

    setup({ phase: 'error', error: 'Download returned 502' });
    render(<UpdateModal />);
    expect(screen.getByText('Download returned 502')).toBeTruthy();
  });

  it('shows nothing mid-check even if left open', () => {
    setup({ phase: 'checking' });
    const { container } = render(<UpdateModal />);
    expect(container.innerHTML).toBe('');
  });
});
