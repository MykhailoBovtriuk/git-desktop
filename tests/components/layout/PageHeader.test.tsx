// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageHeader } from '../../../src/components/layout/PageHeader';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('PageHeader', () => {
  const crumbs = [{ label: 'Settings', onClick: vi.fn() }, { label: 'Account' }];

  it('back goes one level up', () => {
    const onBack = vi.fn();
    render(<PageHeader crumbs={crumbs} onBack={onBack} />);

    fireEvent.click(screen.getByText('← back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // The back link is the only exit now; the close icon is gone.
  it('offers no second way out of the screen', () => {
    render(<PageHeader crumbs={crumbs} onBack={vi.fn()} />);

    expect(screen.queryByLabelText('close')).toBeNull();
    expect(screen.getAllByRole('button').filter(b => b.textContent === '← back')).toHaveLength(1);
  });

  it('shows the actions a screen puts in the header', () => {
    render(
      <PageHeader crumbs={crumbs} onBack={vi.fn()}>
        <button>check for updates</button>
      </PageHeader>,
    );

    expect(screen.getByText('check for updates')).toBeTruthy();
  });
});
