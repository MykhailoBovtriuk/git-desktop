// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Breadcrumbs } from '../../../src/shared/ui/Breadcrumbs';

describe('Breadcrumbs', () => {
  it('makes every crumb but the last one clickable', () => {
    const onSettings = vi.fn();
    render(
      <Breadcrumbs crumbs={[{ label: 'Settings', onClick: onSettings }, { label: 'Account' }]} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onSettings).toHaveBeenCalledOnce();
    // The current page is not a link to itself.
    expect(screen.queryByRole('button', { name: 'Account' })).toBeNull();
  });

  it('marks the last crumb as the current page for screen readers', () => {
    render(
      <Breadcrumbs crumbs={[{ label: 'Settings', onClick: vi.fn() }, { label: 'Account' }]} />,
    );
    expect(screen.getByText('Account')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Settings')).not.toHaveAttribute('aria-current');
  });

  it('separates crumbs and hides the separator from screen readers', () => {
    const { container } = render(
      <Breadcrumbs
        crumbs={[
          { label: 'A', onClick: vi.fn() },
          { label: 'B', onClick: vi.fn() },
          { label: 'C' },
        ]}
      />,
    );
    const separators = [...container.querySelectorAll('[aria-hidden="true"]')];
    expect(separators).toHaveLength(2);
    expect(separators.every(s => s.textContent === '/')).toBe(true);
  });

  it('renders a single crumb without any separator', () => {
    const { container } = render(<Breadcrumbs crumbs={[{ label: 'About' }]} />);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it('does not turn a crumb into a button when it has no handler', () => {
    render(<Breadcrumbs crumbs={[{ label: 'Settings' }, { label: 'Account' }]} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
