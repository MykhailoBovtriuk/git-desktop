// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PushButton } from '../../../src/components/staging/PushButton';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';
import { useAccountStore } from '../../../src/stores/account-store';
import type { AheadBehind } from '../../../src/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/repo-store', () => ({ useRepoStore: vi.fn() }));
vi.mock('../../../src/stores/ui-store', () => ({ useUiStore: vi.fn() }));
vi.mock('../../../src/stores/account-store', () => ({ useAccountStore: vi.fn() }));

const PUBLISHED: AheadBehind = { ahead: 0, behind: 0, upstream: 'origin/main' };

function setup({
  aheadBehind = PUBLISHED,
  remoteHost = 'github.com' as string | null,
  currentBranch = 'main',
  headCommit = 'a1b2c3d' as string | null,
  push = vi.fn().mockResolvedValue(undefined),
} = {}) {
  const repoState = {
    remoteHost,
    remoteProtocol: 'https',
    currentBranch,
    headCommit,
    aheadBehind,
    fetch: vi.fn(),
    pull: vi.fn(),
    push,
    publishBranch: vi.fn().mockResolvedValue(undefined),
  };
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
  vi.mocked(useUiStore).mockImplementation(((sel: any) => sel({ addToast: vi.fn() })) as any);
  vi.mocked(useAccountStore).mockImplementation(((sel: any) =>
    sel({ openSignIn: vi.fn() })) as any);
  return repoState;
}

describe('PushButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stays hidden while there is nothing to push', () => {
    setup();
    const { container } = render(<PushButton />);
    expect(container).toBeEmptyDOMElement();
  });

  // Right after a commit the branch is ahead, and the button shows up.
  it('pushes with the count once the branch is ahead', async () => {
    const repo = setup({ aheadBehind: { ...PUBLISHED, ahead: 2 } });
    render(<PushButton />);
    expect(screen.getByText('↑2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(repo.push).toHaveBeenCalledTimes(1));
  });

  it('publishes a branch without an upstream', async () => {
    const repo = setup({ aheadBehind: { ...PUBLISHED, upstream: null } });
    render(<PushButton />);
    fireEvent.click(screen.getByText('publishBranch'));
    await waitFor(() => expect(repo.publishBranch).toHaveBeenCalledTimes(1));
    expect(repo.push).not.toHaveBeenCalled();
  });

  // The remote would reject the push anyway.
  it('is disabled with a hint while the branch is also behind', () => {
    setup({ aheadBehind: { ...PUBLISHED, ahead: 1, behind: 2 } });
    render(<PushButton />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', 'pullFirst');
  });

  it('stays hidden without a remote', () => {
    setup({ remoteHost: null, aheadBehind: { ...PUBLISHED, ahead: 1 } });
    const { container } = render(<PushButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('stays hidden on a detached or unborn HEAD', () => {
    setup({ currentBranch: '', aheadBehind: { ...PUBLISHED, upstream: null } });
    const { container, rerender } = render(<PushButton />);
    expect(container).toBeEmptyDOMElement();
    setup({ headCommit: null, aheadBehind: { ...PUBLISHED, upstream: null } });
    rerender(<PushButton />);
    expect(container).toBeEmptyDOMElement();
  });
});
