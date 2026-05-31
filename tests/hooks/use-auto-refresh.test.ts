// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoRefresh } from '../../src/hooks/use-auto-refresh';
import { useRepoStore } from '../../src/stores/repo-store';

vi.mock('../../src/stores/repo-store', () => ({
  useRepoStore: Object.assign(
    vi.fn(),
    { getState: vi.fn() }
  ),
}));

const mockRefresh = vi.fn();
const mockGetState = vi.fn(() => ({ refresh: mockRefresh }));

describe('useAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRefresh.mockClear();
    mockGetState.mockClear();
    (vi.mocked(useRepoStore) as any).getState = mockGetState;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not start interval when repoPath is null', () => {
    vi.mocked(useRepoStore).mockImplementation((selector: any) =>
      selector({ repoPath: null, refresh: mockRefresh } as any)
    );

    renderHook(() => useAutoRefresh());
    vi.advanceTimersByTime(30_000);

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('starts interval when repoPath is set', () => {
    vi.mocked(useRepoStore).mockImplementation((selector: any) =>
      selector({ repoPath: '/some/repo', refresh: mockRefresh } as any)
    );

    renderHook(() => useAutoRefresh());
    vi.advanceTimersByTime(30_000);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('calls refresh again after 60s (two intervals)', () => {
    vi.mocked(useRepoStore).mockImplementation((selector: any) =>
      selector({ repoPath: '/some/repo', refresh: mockRefresh } as any)
    );

    renderHook(() => useAutoRefresh());
    vi.advanceTimersByTime(60_000);

    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  it('clears interval on unmount', () => {
    vi.mocked(useRepoStore).mockImplementation((selector: any) =>
      selector({ repoPath: '/some/repo', refresh: mockRefresh } as any)
    );

    const { unmount } = renderHook(() => useAutoRefresh());
    unmount();
    vi.advanceTimersByTime(30_000);

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('restarts interval when repoPath changes from null to value', () => {
    let currentRepoPath: string | null = null;

    vi.mocked(useRepoStore).mockImplementation((selector: any) =>
      selector({ repoPath: currentRepoPath, refresh: mockRefresh } as any)
    );

    const { rerender } = renderHook(() => useAutoRefresh());

    // With null repoPath, advancing 30s should not trigger refresh
    vi.advanceTimersByTime(30_000);
    expect(mockRefresh).not.toHaveBeenCalled();

    // Now set repoPath and re-render to trigger effect re-evaluation
    currentRepoPath = '/some/repo';
    rerender();

    // Advance another 30s — interval should now fire once
    vi.advanceTimersByTime(30_000);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
