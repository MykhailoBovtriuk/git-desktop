// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { STARTUP_CHECK_DELAY_MS, useUpdateCheck } from '../../src/hooks/use-update-check';
import { useUpdateStore } from '../../src/stores/update-store';
import { useSettingsStore } from '../../src/stores/settings-store';
import { updateApi } from '../../src/api/update-api';
import type { UpdateProgress } from '../../src/types';

vi.mock('../../src/api/update-api', () => ({
  updateApi: { onProgress: vi.fn() },
}));

const unsubscribe = vi.fn();
let check: ReturnType<
  typeof vi.fn<(opts?: { silent?: boolean; force?: boolean }) => Promise<void>>
>;

describe('useUpdateCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(updateApi.onProgress).mockReturnValue(unsubscribe);
    check = vi
      .fn<(opts?: { silent?: boolean; force?: boolean }) => Promise<void>>()
      .mockResolvedValue(undefined);
    useUpdateStore.setState({ check, progress: null });
    useSettingsStore.setState({ autoCheckUpdates: true });
  });

  afterEach(() => vi.useRealTimers());

  it('checks silently, exactly once, after the startup delay', () => {
    renderHook(() => useUpdateCheck());

    vi.advanceTimersByTime(STARTUP_CHECK_DELAY_MS - 1);
    expect(check).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(check).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith({ silent: true });

    vi.advanceTimersByTime(STARTUP_CHECK_DELAY_MS * 10);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('does not check when automatic checks are off', () => {
    useSettingsStore.setState({ autoCheckUpdates: false });
    renderHook(() => useUpdateCheck());

    vi.advanceTimersByTime(STARTUP_CHECK_DELAY_MS * 2);
    expect(check).not.toHaveBeenCalled();
  });

  it('does not check if unmounted before the delay', () => {
    const { unmount } = renderHook(() => useUpdateCheck());
    unmount();

    vi.advanceTimersByTime(STARTUP_CHECK_DELAY_MS);
    expect(check).not.toHaveBeenCalled();
  });

  it('feeds pushed progress into the store and unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useUpdateCheck());

    const progress: UpdateProgress = {
      version: '1.2.0',
      receivedBytes: 10,
      totalBytes: 100,
      percent: 10,
      bytesPerSecond: 0,
    };
    vi.mocked(updateApi.onProgress).mock.calls[0][0](progress);
    expect(useUpdateStore.getState().progress).toEqual(progress);

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
