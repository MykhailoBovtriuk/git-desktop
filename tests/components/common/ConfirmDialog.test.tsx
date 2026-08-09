// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { ConfirmDialog } from '../../../src/components/common/ConfirmDialog';
import { useUiStore } from '../../../src/stores/ui-store';

beforeEach(() => {
  useUiStore.setState({ confirmRequest: null });
});

describe('ConfirmDialog', () => {
  it('renders nothing without a pending request', () => {
    const { container } = render(<ConfirmDialog />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the request and resolves true on confirm', async () => {
    render(<ConfirmDialog />);
    const promise = useUiStore.getState().requestConfirm({
      title: 'Delete branch',
      message: 'Really delete feature?',
      confirmLabel: 'Delete',
      danger: true,
    });

    expect(await screen.findByText('Really delete feature?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await expect(promise).resolves.toBe(true);
    expect(useUiStore.getState().confirmRequest).toBeNull();
  });

  it('resolves false on cancel', async () => {
    render(<ConfirmDialog />);
    const promise = useUiStore.getState().requestConfirm({
      title: 'T',
      message: 'M',
      confirmLabel: 'OK',
    });

    fireEvent.click(await screen.findByRole('button', { name: 'common:cancel' }));
    await expect(promise).resolves.toBe(false);
  });
});
