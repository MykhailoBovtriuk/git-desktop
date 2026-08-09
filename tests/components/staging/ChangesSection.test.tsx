// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  // error.unknown is empty in the real footer namespace — the raw git message
  // must fall through for unclassified errors.
  useTranslation: () => ({ t: (k: string) => (k === 'error.unknown' ? '' : k) }),
}));
vi.mock('../../../src/stores/repo-store', () => ({
  useRepoStore: vi.fn(),
  CheckoutConflictError: class CheckoutConflictError extends Error {},
}));
vi.mock('../../../src/components/staging/CommitForm', () => ({
  CommitForm: () => null,
}));

import { ChangesSection } from '../../../src/components/staging/ChangesSection';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';

const repoState = {
  status: {
    staged: [],
    unstaged: [{ path: 'a.txt', status: 'M', staged: false }],
  },
  stageFiles: vi.fn(),
  unstageFiles: vi.fn(),
  discardChanges: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  useUiStore.setState({ toasts: [], confirmRequest: null });
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
});

describe('ChangesSection error surfacing', () => {
  // Regression: onClick={() => stageFiles(...)} left rejections unhandled —
  // an index.lock failure produced zero feedback and the user kept clicking.
  it('shows an error toast when staging fails', async () => {
    repoState.stageFiles.mockRejectedValue(new Error('index.lock exists'));
    render(<ChangesSection />);

    fireEvent.click(screen.getByText('stageAll'));

    await waitFor(() => expect(useUiStore.getState().toasts).toHaveLength(1));
    expect(useUiStore.getState().toasts[0]).toMatchObject({ variant: 'error' });
    expect(useUiStore.getState().toasts[0].message).toContain('index.lock');
  });

  it('shows an error toast when discarding fails', async () => {
    repoState.discardChanges.mockRejectedValue(new Error('discard boom'));
    render(<ChangesSection />);

    // FileList exposes the per-file discard button by its title. The click
    // opens the in-app confirm dialog — approve it through the store.
    fireEvent.click(screen.getByTitle('discard'));
    await waitFor(() => expect(useUiStore.getState().confirmRequest).not.toBeNull());
    useUiStore.getState().resolveConfirm(true);

    await waitFor(() => expect(useUiStore.getState().toasts).toHaveLength(1));
    expect(useUiStore.getState().toasts[0]).toMatchObject({ variant: 'error' });
  });

  it('does not discard when the confirm dialog is cancelled', async () => {
    render(<ChangesSection />);

    fireEvent.click(screen.getByTitle('discard'));
    await waitFor(() => expect(useUiStore.getState().confirmRequest).not.toBeNull());
    useUiStore.getState().resolveConfirm(false);

    await waitFor(() => expect(useUiStore.getState().confirmRequest).toBeNull());
    expect(repoState.discardChanges).not.toHaveBeenCalled();
  });
});
