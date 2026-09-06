// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageHeader } from '../../../src/components/layout/PageHeader';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('PageHeader', () => {
  it('back goes one level up, close leaves the overlay', () => {
    const onBack = vi.fn();
    const onClose = vi.fn();
    render(
      <PageHeader
        crumbs={[{ label: 'Settings', onClick: vi.fn() }, { label: 'Account' }]}
        onBack={onBack}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText('← back'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
