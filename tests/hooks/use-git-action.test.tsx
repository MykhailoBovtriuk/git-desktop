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
import { useAccountStore } from '../../src/stores/account-store';
import { CheckoutConflictError, MergeConflictError, useRepoStore } from '../../src/stores/repo-store';

const lastToast = () => {
  const { toasts } = useUiStore.getState();
  return toasts[toasts.length - 1];
};

describe('useGitAction', () => {
  beforeEach(() => {
    useUiStore.setState({ toasts: [] });
    useRepoStore.setState({ remoteHost: null });
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

  // merge() throws MergeConflictError after opening the conflict modal — the
  // regression was a green "Merged" toast rendered next to that modal.
  it('swallows MergeConflictError without a toast', async () => {
    const { result } = renderHook(() => useGitAction());
    const ok = await result.current(() => Promise.reject(new MergeConflictError()), {
      title: 'Merge',
    });
    expect(ok).toBe(false);
    expect(useUiStore.getState().toasts).toHaveLength(0);
  });

  // The hook used to take only `kind` from classifyGitError and drop `action`,
  // so an auth failure reached the user as a dead end with nowhere to go.
  it('offers a way out of an authentication failure', async () => {
    useRepoStore.setState({ remoteHost: 'github.com' });
    const openSignIn = vi.fn().mockResolvedValue(undefined);
    useAccountStore.setState({ openSignIn });
    const { result } = renderHook(() => useGitAction());

    await result.current(() => Promise.reject(new Error('Authentication failed')), {
      title: 'Push',
    });

    const toast = lastToast();
    expect(toast.variant).toBe('error');
    expect(toast.action).toBeDefined();

    toast.action!.onClick();
    // Aimed at the server that refused, not at a settings page the user would
    // then have to navigate.
    expect(openSignIn).toHaveBeenCalledWith('github.com');
  });

  // Nothing to sign in to: a button that opened an empty dialog would be worse
  // than no button.
  it('omits the action when the repository has no remote', async () => {
    const { result } = renderHook(() => useGitAction());
    await result.current(() => Promise.reject(new Error('Authentication failed')), {
      title: 'Push',
    });
    expect(lastToast().action).toBeUndefined();
  });

  it('leaves other failures without an action button', async () => {
    const { result } = renderHook(() => useGitAction());
    await result.current(() => Promise.reject(new Error('some unrelated failure')), {
      title: 'Push',
    });
    expect(lastToast().action).toBeUndefined();
  });
});
