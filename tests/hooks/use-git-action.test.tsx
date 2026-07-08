// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  // Behaves like the real footer namespace: known kinds get a friendly text,
  // `error.unknown` is empty so the caller falls back to the raw message.
  useTranslation: () => ({ t: (k: string) => (k === 'error.unknown' ? '' : `friendly:${k}`) }),
}));

import { useGitAction } from '../../src/hooks/use-git-action';
import { useUiStore } from '../../src/stores/ui-store';
import { CheckoutConflictError } from '../../src/stores/repo-store';

const lastToast = () => {
  const { toasts } = useUiStore.getState();
  return toasts[toasts.length - 1];
};

describe('useGitAction', () => {
  beforeEach(() => {
    useUiStore.setState({ toasts: [] });
  });

  it('returns true on success and shows the success toast when given one', async () => {
    const { result } = renderHook(() => useGitAction());
    const ok = await result.current(() => Promise.resolve(), {
      title: 'Stage',
      success: 'staged!',
    });
    expect(ok).toBe(true);
    expect(lastToast()).toMatchObject({ variant: 'success', title: 'Stage', message: 'staged!' });
  });

  it('stays silent on success when no success message is given', async () => {
    const { result } = renderHook(() => useGitAction());
    await result.current(() => Promise.resolve(), { title: 'Stage' });
    expect(useUiStore.getState().toasts).toHaveLength(0);
  });

  it('returns false and shows a friendly message for a classified error', async () => {
    const { result } = renderHook(() => useGitAction());
    const ok = await result.current(
      () => Promise.reject(new Error('CONFLICT (content): Merge conflict in a.ts')),
      { title: 'Merge' },
    );
    expect(ok).toBe(false);
    expect(lastToast()).toMatchObject({
      variant: 'error',
      title: 'Merge',
      message: 'friendly:error.conflict',
    });
  });

  it('falls back to the raw message for unrecognized errors', async () => {
    const { result } = renderHook(() => useGitAction());
    await result.current(() => Promise.reject(new Error('weird failure')), { title: 'Op' });
    expect(lastToast()).toMatchObject({ variant: 'error', message: 'weird failure' });
  });

  // checkout() throws CheckoutConflictError after opening its own modal — a
  // toast on top of the modal would be noise.
  it('swallows CheckoutConflictError without a toast', async () => {
    const { result } = renderHook(() => useGitAction());
    const ok = await result.current(() => Promise.reject(new CheckoutConflictError()), {
      title: 'Checkout',
    });
    expect(ok).toBe(false);
    expect(useUiStore.getState().toasts).toHaveLength(0);
  });
});
