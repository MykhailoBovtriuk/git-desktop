// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoRefresh } from '../../src/hooks/use-auto-refresh';
import { useRepoStore } from '../../src/stores/repo-store';

vi.mock('../../src/stores/repo-store', () => ({
  useRepoStore: Object.assign(vi.fn(), { getState: vi.fn() }),
}));

const mockRefresh = vi.fn();
const mockGetState = vi.fn(() => ({ refresh: mockRefresh }));

// Captured onGitChanged callback so tests can emit a 'repo:changed' event.
let gitChangedCb: (() => void) | null = null;
const unsubscribe = vi.fn();
const onGitChanged = vi.fn((cb: () => void) => {
  gitChangedCb = cb;
  return unsubscribe;
});

describe('useAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRefresh.mockClear();
    mockGetState.mockClear();
    unsubscribe.mockClear();
    onGitChanged.mockClear();
    gitChangedCb = null;
    (vi.mocked(useRepoStore) as any).getState = mockGetState;
    (window as any).electronAPI = { onGitChanged };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as any).electronAPI;
  });

  const withRepo = (repoPath: string | null = '/some/repo') =>
    vi
      .mocked(useRepoStore)
      .mockImplementation((selector: any) => selector({ repoPath, refresh: mockRefresh } as any));

  it('does not subscribe or poll when repoPath is null', () => {
    withRepo(null);
    renderHook(() => useAutoRefresh());
    vi.advanceTimersByTime(60_000);
    expect(onGitChanged).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('subscribes to onGitChanged when a repo is open', () => {
    withRepo();
    renderHook(() => useAutoRefresh());
    expect(onGitChanged).toHaveBeenCalledTimes(1);
  });

  it('refreshes (debounced) when a git change event fires', () => {
    withRepo();
    renderHook(() => useAutoRefresh());
    gitChangedCb!();
    // Nothing yet — the refresh is debounced.
    expect(mockRefresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('coalesces a burst of events into a single refresh', () => {
    withRepo();
    renderHook(() => useAutoRefresh());
    gitChangedCb!();
    gitChangedCb!();
    gitChangedCb!();
    vi.advanceTimersByTime(300);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('runs the fallback poll roughly once a minute', () => {
    withRepo();
    renderHook(() => useAutoRefresh());
    vi.advanceTimersByTime(60_000);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes and stops polling on unmount', () => {
    withRepo();
    const { unmount } = renderHook(() => useAutoRefresh());
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('re-subscribes when repoPath changes from null to a value', () => {
    let currentRepoPath: string | null = null;
    vi.mocked(useRepoStore).mockImplementation((selector: any) =>
      selector({ repoPath: currentRepoPath, refresh: mockRefresh } as any),
    );
    const { rerender } = renderHook(() => useAutoRefresh());
    expect(onGitChanged).not.toHaveBeenCalled();

    currentRepoPath = '/some/repo';
    rerender();
    expect(onGitChanged).toHaveBeenCalledTimes(1);
  });

  // P4.25 — auto-refresh must stand aside while a tracked git operation is in
  // flight, so it never interleaves a stale snapshot mid-commit/checkout/merge.
  it('skips refresh while an operation is busy', () => {
    withRepo();
    mockGetState.mockReturnValue({ refresh: mockRefresh, busyOperation: 'commit' } as any);
    renderHook(() => useAutoRefresh());

    // Event path is guarded.
    gitChangedCb!();
    vi.advanceTimersByTime(300);
    expect(mockRefresh).not.toHaveBeenCalled();

    // Fallback poll is guarded too.
    vi.advanceTimersByTime(60_000);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
