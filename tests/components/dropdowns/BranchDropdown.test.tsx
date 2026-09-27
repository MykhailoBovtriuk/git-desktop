// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/repo-store', () => ({
  useRepoStore: vi.fn(),
  CheckoutConflictError: class CheckoutConflictError extends Error {},
  MergeConflictError: class MergeConflictError extends Error {},
}));
vi.mock('../../../src/stores/ui-store', () => ({ useUiStore: vi.fn() }));
vi.mock('../../../src/stores/account-store', () => ({
  useAccountStore: (sel: any) => sel({ openSignIn: vi.fn() }),
}));

import { BranchDropdown } from '../../../src/components/dropdowns/BranchDropdown';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';

const repoState: any = {
  branches: [
    { name: 'main', current: true, remote: false },
    { name: 'feature', current: false, remote: false },
  ],
  aheadBehind: { ahead: 0, behind: 2, upstream: 'origin/main' },
  remoteHost: 'github.com',
  pull: vi.fn().mockResolvedValue('Updated'),
  push: vi.fn().mockResolvedValue(undefined),
  fetch: vi.fn().mockResolvedValue(undefined),
  publishBranch: vi.fn().mockResolvedValue(undefined),
  checkout: vi.fn(),
  merge: vi.fn(),
  rebase: vi.fn(),
  deleteBranch: vi.fn(),
  deleteRemoteBranch: vi.fn(),
  mergeState: null,
  merging: false,
};
const uiState: any = { addToast: vi.fn(), requestConfirm: vi.fn(), openNewBranch: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  repoState.mergeState = null;
  repoState.merging = false;
  repoState.aheadBehind = { ahead: 0, behind: 2, upstream: 'origin/main' };
  repoState.remoteHost = 'github.com';
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
  vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(uiState)) as any);
});

// The dropdown panel is the element carrying the branch actions; when a merge
// is in progress it must be inert so the user can't checkout mid-merge.
const panel = (container: HTMLElement) => container.querySelector('.p-2') as HTMLElement;

describe('BranchDropdown merge lock', () => {
  it('is interactive when idle', () => {
    const { container } = render(<BranchDropdown onClose={() => {}} />);
    expect(panel(container).className).not.toContain('pointer-events-none');
  });

  // Regression: after a restart mid-merge git has MERGE_HEAD (merging=true) but
  // the renderer-only mergeState is null — the dropdown must still be locked.
  it('is locked when merging even without a mergeState', () => {
    repoState.merging = true;
    repoState.mergeState = null;
    const { container } = render(<BranchDropdown onClose={() => {}} />);
    expect(panel(container).className).toContain('pointer-events-none');
  });

  it('is locked when a mergeState is present', () => {
    repoState.mergeState = { sourceBranch: 'f', targetBranch: 'main', conflictingFiles: ['a'] };
    const { container } = render(<BranchDropdown onClose={() => {}} />);
    expect(panel(container).className).toContain('pointer-events-none');
  });
});

describe('BranchDropdown new branch', () => {
  it('opens the new-branch dialog and closes the dropdown', () => {
    const onClose = vi.fn();
    render(<BranchDropdown onClose={onClose} />);

    fireEvent.click(screen.getByText('new'));
    expect(uiState.openNewBranch).toHaveBeenCalledTimes(1);
    // The dialog is mounted outside the dropdown, which would otherwise sit on
    // top of it.
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Typing a name that matches nothing is exactly when you want to create it,
  // so the row the action lives in must not be filtered away with the list.
  it('offers new even when the filter matches no local branch', () => {
    render(<BranchDropdown onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('searchPlaceholder'), {
      target: { value: 'nothing-matches-this' },
    });

    expect(screen.queryByText('main')).toBeNull();
    expect(screen.getByText('new')).toBeTruthy();
  });
});

const openContext = (name: string) =>
  fireEvent.click(
    screen.getByText(name).closest('.relative')!.querySelector('[aria-label="moreActions"]')!,
  );

describe('BranchDropdown pull and push', () => {
  it('offers pull right after checkout in the current branch menu', async () => {
    const onClose = vi.fn();
    render(<BranchDropdown onClose={onClose} />);
    openContext('main');
    const items = screen.getAllByRole('button').map(b => b.textContent);
    expect(items.indexOf('pull↓2')).toBe(items.indexOf('checkout') + 1);
    fireEvent.click(screen.getByText('pull'));
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(repoState.pull).toHaveBeenCalledTimes(1));
  });

  it('pushes the current branch', async () => {
    repoState.aheadBehind = { ahead: 1, behind: 0, upstream: 'origin/main' };
    render(<BranchDropdown onClose={() => {}} />);
    openContext('main');
    expect(screen.getByText('↑1')).toBeTruthy();
    fireEvent.click(screen.getByText('push'));
    await waitFor(() => expect(repoState.push).toHaveBeenCalledTimes(1));
  });

  // git pull and push only ever move HEAD's branch.
  it('offers neither for another branch', () => {
    render(<BranchDropdown onClose={() => {}} />);
    openContext('feature');
    expect(screen.queryByText('pull')).toBeNull();
    expect(screen.queryByText('push')).toBeNull();
  });

  it('offers publish instead before the branch has an upstream', async () => {
    repoState.aheadBehind = { ahead: 0, behind: 0, upstream: null };
    render(<BranchDropdown onClose={() => {}} />);
    openContext('main');
    expect(screen.queryByText('pull')).toBeNull();
    expect(screen.queryByText('push')).toBeNull();
    fireEvent.click(screen.getByText('publishBranch'));
    await waitFor(() => expect(repoState.publishBranch).toHaveBeenCalledTimes(1));
  });

  it('offers nothing to sync in a repository without a remote', () => {
    repoState.remoteHost = null;
    render(<BranchDropdown onClose={() => {}} />);
    openContext('main');
    expect(screen.queryByText('pull')).toBeNull();
    expect(screen.queryByText('publishBranch')).toBeNull();
  });
});

describe('BranchDropdown fetch', () => {
  it('fetches from the remote section header and stays open', async () => {
    const onClose = vi.fn();
    render(<BranchDropdown onClose={onClose} />);
    expect(screen.getByText('remote')).toBeTruthy();
    fireEvent.click(screen.getByText('fetch'));
    await waitFor(() => expect(repoState.fetch).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('has no fetch without a remote', () => {
    repoState.remoteHost = null;
    render(<BranchDropdown onClose={() => {}} />);
    expect(screen.queryByText('fetch')).toBeNull();
  });
});
