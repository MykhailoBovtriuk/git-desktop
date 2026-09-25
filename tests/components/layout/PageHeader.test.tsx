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

  // The header used to carry a close icon beside the back link. Both left the
  // same screen and differed only in how far, which is a choice with nothing at
  // stake either way — so back is the whole exit now.
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
