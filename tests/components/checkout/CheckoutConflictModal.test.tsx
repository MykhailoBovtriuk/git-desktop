// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/repo-store', () => ({
  useRepoStore: vi.fn(),
  CheckoutConflictError: class CheckoutConflictError extends Error {},
}));

import { CheckoutConflictModal } from '../../../src/components/checkout/CheckoutConflictModal';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';

const repoState = {
  checkoutConflict: { branch: 'feature' },
  stashAndCheckout: vi.fn(),
  migrateCheckout: vi.fn(),
  forceCheckout: vi.fn(),
  cancelCheckout: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  useUiStore.setState({ toasts: [] });
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
});

describe('CheckoutConflictModal double-submit protection', () => {
  // Regression: buttons stayed active while the async action ran — a double
  // click fired the action twice and always showed a success toast even for
  // the second no-op run.
  it('disables all action buttons while an action is in flight', async () => {
    repoState.stashAndCheckout.mockReturnValue(new Promise(() => {}));
    render(<CheckoutConflictModal />);

    fireEvent.click(screen.getByText('stashAction'));

    expect(screen.getByText('stashAction').closest('button')).toBeDisabled();
    expect(screen.getByText('migrateAction').closest('button')).toBeDisabled();
    expect(screen.getByText('forceAction').closest('button')).toBeDisabled();
    expect(repoState.stashAndCheckout).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('stashAction'));
    expect(repoState.stashAndCheckout).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast with a friendly message when the action fails', async () => {
    repoState.migrateCheckout.mockRejectedValue(
      new Error('CONFLICT (content): Merge conflict in a.ts'),
    );
    render(<CheckoutConflictModal />);

    fireEvent.click(screen.getByText('migrateAction'));

    await vi.waitFor(() => expect(useUiStore.getState().toasts).toHaveLength(1));
    expect(useUiStore.getState().toasts[0]).toMatchObject({
      variant: 'error',
      message: 'error.conflict',
    });
  });
});
