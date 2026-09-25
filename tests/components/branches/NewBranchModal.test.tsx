// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/repo-store', () => ({
  useRepoStore: vi.fn(),
  CheckoutConflictError: class CheckoutConflictError extends Error {},
  MergeConflictError: class MergeConflictError extends Error {},
}));
vi.mock('../../../src/stores/ui-store', () => ({ useUiStore: vi.fn() }));
vi.mock('../../../src/hooks/use-git-action', () => ({ useGitAction: () => runAction }));

import { NewBranchModal } from '../../../src/components/branches/NewBranchModal';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';

const runAction = vi.fn(async (fn: () => Promise<unknown>) => {
  await fn();
  return true;
});

const repoState: any = {
  createBranch: vi.fn().mockResolvedValue(undefined),
  currentBranch: 'main',
  status: { staged: [], unstaged: [] },
};
const uiState: any = {
  newBranchOpen: true,
  closeNewBranch: vi.fn(),
  addToast: vi.fn(),
};

const dirty = () => {
  repoState.status = { staged: [{ path: 'a.txt' }], unstaged: [{ path: 'b.txt' }] };
};

beforeEach(() => {
  vi.clearAllMocks();
  runAction.mockImplementation(async (fn: () => Promise<unknown>) => {
    await fn();
    return true;
  });
  repoState.status = { staged: [], unstaged: [] };
  repoState.createBranch.mockResolvedValue(undefined);
  uiState.newBranchOpen = true;
});

const typeName = (name: string) =>
  fireEvent.change(screen.getByPlaceholderText('namePlaceholder'), { target: { value: name } });

describe('NewBranchModal', () => {
  it('renders nothing when it has not been opened', () => {
    uiState.newBranchOpen = false;
    vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(uiState)) as any);
    vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);

    const { container } = render(<NewBranchModal />);
    expect(container.firstChild).toBeNull();
  });

  it('will not create a branch with a blank name', () => {
    vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(uiState)) as any);
    vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
    render(<NewBranchModal />);

    expect(screen.getByText('create').closest('button')).toBeDisabled();
    typeName('   ');
    expect(screen.getByText('create').closest('button')).toBeDisabled();
  });

  // Nothing uncommitted means there is nothing to decide, so the second step
  // would be a question with one possible answer.
  it('creates straight away on a clean tree, with no question asked', async () => {
    vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(uiState)) as any);
    vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
    render(<NewBranchModal />);

    typeName('feature/login');
    fireEvent.click(screen.getByText('create'));

    await waitFor(() => expect(repoState.createBranch).toHaveBeenCalledWith('feature/login', 'bring'));
    expect(screen.queryByText('changesTitle')).toBeNull();
    expect(uiState.closeNewBranch).toHaveBeenCalled();
  });

  it('asks what to do with uncommitted changes, and carries them over', async () => {
    dirty();
    vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(uiState)) as any);
    vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
    render(<NewBranchModal />);

    typeName('feature/login');
    fireEvent.click(screen.getByText('create'));

    expect(repoState.createBranch).not.toHaveBeenCalled();
    expect(screen.getByText('changesTitle')).toBeTruthy();

    fireEvent.click(screen.getByText('bringAction'));
    await waitFor(() => expect(repoState.createBranch).toHaveBeenCalledWith('feature/login', 'bring'));
  });

  it('leaves the changes behind when asked to', async () => {
    dirty();
    vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(uiState)) as any);
    vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
    render(<NewBranchModal />);

    typeName('feature/login');
    fireEvent.click(screen.getByText('create'));
    fireEvent.click(screen.getByText('leaveAction'));

    await waitFor(() => expect(repoState.createBranch).toHaveBeenCalledWith('feature/login', 'leave'));
  });

  // A name already taken is the common miss, and retyping it from scratch to
  // fix one character would be its own small punishment.
  it('keeps the dialog open with the name intact when git refuses', async () => {
    runAction.mockResolvedValue(false);
    vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(uiState)) as any);
    vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
    render(<NewBranchModal />);

    typeName('main');
    fireEvent.click(screen.getByText('create'));

    await waitFor(() => expect(runAction).toHaveBeenCalled());
    expect(uiState.closeNewBranch).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('namePlaceholder')).toHaveValue('main');
  });
});
