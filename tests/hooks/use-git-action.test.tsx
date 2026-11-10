// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  // Behaves like the real footer namespace: known kinds get a friendly text,
  // `error.unknown` is empty so the caller falls back to the raw message.
  useTranslation: () => ({ t: (k: string) => (k === 'error.unknown' ? '' : `friendly:${k}`) }),
}));

const { openOrgAccess } = vi.hoisted(() => ({
  openOrgAccess: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../src/api/account-api', () => ({ accountApi: { openOrgAccess } }));
const { markKind } = vi.hoisted(() => ({ markKind: vi.fn(() => Promise.resolve(true)) }));
vi.mock('../../src/api/log-api', () => ({ logApi: { markKind } }));

import { useGitAction } from '../../src/hooks/use-git-action';
import { useUiStore } from '../../src/stores/ui-store';
import { useLogStore } from '../../src/stores/log-store';
import { useAccountStore } from '../../src/stores/account-store';
import {
  CheckoutConflictError,
  MergeConflictError,
  useRepoStore,
} from '../../src/stores/repo-store';

const lastToast = () => {
  const { toasts } = useUiStore.getState();
  return toasts[toasts.length - 1];
};

describe('useGitAction', () => {
  beforeEach(() => {
    useUiStore.setState({ toasts: [] });
    useRepoStore.setState({ remoteHost: null, remoteProtocol: null, currentBranch: 'main' });
  });

  it('builds the success message from the result when given a function', async () => {
    const { result } = renderHook(() => useGitAction());
    await result.current(() => Promise.resolve('Fast-forward'), {
      title: 'Pull failed',
      successTitle: 'Pull',
      success: out => `done: ${out}`,
    });
    expect(lastToast()).toMatchObject({
      variant: 'success',
      title: 'Pull',
      message: 'done: Fast-forward',
    });
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

  it('links the toast to the very entry main logged the failure under', async () => {
    const { result } = renderHook(() => useGitAction());
    const err = Object.assign(new Error('rejected'), { logId: 'entry-7' });
    await result.current(() => Promise.reject(err), { title: 'Push' });
    const details = lastToast().details!;
    expect(details).toBeDefined();
    details.onClick();
    expect(useLogStore.getState().focusId).toBe('entry-7');
    expect(useUiStore.getState().rightPanel).toBe('logs');
  });

  it('offers no link to the logs for a failure nothing logged', async () => {
    const { result } = renderHook(() => useGitAction());
    await result.current(() => Promise.reject(new Error('local only')), { title: 'Op' });
    expect(lastToast().details).toBeUndefined();
  });

  it('swallows CheckoutConflictError without a toast', async () => {
    const { result } = renderHook(() => useGitAction());
    const ok = await result.current(() => Promise.reject(new CheckoutConflictError()), {
      title: 'Checkout',
    });
    expect(ok).toBe(false);
    expect(useUiStore.getState().toasts).toHaveLength(0);
  });

  it('swallows MergeConflictError without a toast', async () => {
    const { result } = renderHook(() => useGitAction());
    const ok = await result.current(() => Promise.reject(new MergeConflictError()), {
      title: 'Merge',
    });
    expect(ok).toBe(false);
    expect(useUiStore.getState().toasts).toHaveLength(0);
  });

  it('offers sign-in on an authentication failure without opening it', async () => {
    useRepoStore.setState({
      remoteHost: 'github.com',
      remoteProtocol: 'https',
      repoPath: '/src/p',
    });
    const openSignIn = vi.fn().mockResolvedValue(undefined);
    useAccountStore.setState({ openSignIn, phase: null });
    const { result } = renderHook(() => useGitAction());

    await result.current(() => Promise.reject(new Error('Authentication failed')), {
      title: 'Push',
    });

    const toast = lastToast();
    expect(toast.variant).toBe('error');
    expect(toast.action?.label).toBe('friendly:signIn');
    expect(openSignIn).not.toHaveBeenCalled();

    toast.action!.onClick();
    expect(openSignIn).toHaveBeenCalledWith('github.com', '/src/p');
  });

  it('offers to request organization access for a refused repo on the app account', async () => {
    useRepoStore.setState({
      remoteHost: 'github.com',
      remoteProtocol: 'https',
      repoPath: '/src/p',
    });
    const openSignIn = vi.fn().mockResolvedValue(undefined);
    useAccountStore.setState({ openSignIn, phase: null, authSource: 'account' });
    const { result } = renderHook(() => useGitAction());

    await result.current(
      () =>
        Promise.reject(new Error('fatal: unable to access: The requested URL returned error: 403')),
      { title: 'Push' },
    );

    const toast = lastToast();
    expect(toast.message).toBe('friendly:error.orgAccess');
    expect(toast.action?.label).toBe('friendly:requestAccess');
    toast.action!.onClick();
    expect(openOrgAccess).toHaveBeenCalledWith('/src/p');
    expect(openSignIn).not.toHaveBeenCalled();
    useAccountStore.setState({ authSource: null });
  });

  it('marks the logged failure as org access and toasts a page that would not open', async () => {
    useRepoStore.setState({
      remoteHost: 'github.com',
      remoteProtocol: 'https',
      repoPath: '/src/p',
    });
    useAccountStore.setState({ authSource: 'account' });
    openOrgAccess.mockRejectedValueOnce(Object.assign(new Error('no browser'), { logId: 'e-2' }));
    const { result } = renderHook(() => useGitAction());

    const err = Object.assign(new Error('remote: Repository not found.'), { logId: 'e-1' });
    await result.current(() => Promise.reject(err), { title: 'Fetch' });
    expect(markKind).toHaveBeenCalledWith('e-1', 'orgAccess');

    lastToast().action!.onClick();
    await vi.waitFor(() =>
      expect(lastToast()).toMatchObject({
        variant: 'error',
        title: 'friendly:requestAccessFailed',
        message: 'no browser',
      }),
    );
    expect(lastToast().details).toBeDefined();
    useAccountStore.setState({ authSource: null });
  });

  it('leaves the log alone for a plain auth failure', async () => {
    markKind.mockClear();
    const err = Object.assign(new Error('Authentication failed'), { logId: 'e-3' });
    const { result } = renderHook(() => useGitAction());
    await result.current(() => Promise.reject(err), { title: 'Push' });
    expect(markKind).not.toHaveBeenCalled();
  });

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

  it('offers to publish a branch that has no upstream', async () => {
    const publishBranch = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({ publishBranch });
    const { result } = renderHook(() => useGitAction());

    await result.current(
      () => Promise.reject(new Error('fatal: The current branch main has no upstream branch.')),
      { title: 'Push' },
    );

    const toast = lastToast();
    expect(toast.action?.label).toBe('friendly:sync:publishBranch');
    toast.action!.onClick();
    await vi.waitFor(() => expect(publishBranch).toHaveBeenCalledTimes(1));
  });

  it('does not offer to publish on a detached HEAD', async () => {
    useRepoStore.setState({ currentBranch: '' });
    const { result } = renderHook(() => useGitAction());
    await result.current(() => Promise.reject(new Error('has no upstream branch')), {
      title: 'Push',
    });
    expect(lastToast().action).toBeUndefined();
  });
});
