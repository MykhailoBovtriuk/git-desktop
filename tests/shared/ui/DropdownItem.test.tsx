// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DropdownItem, DropdownRow } from '../../../src/shared/ui/DropdownItem';

describe('DropdownItem', () => {
  it('renders an inset rounded row', () => {
    render(<DropdownItem>Fetch</DropdownItem>);
    expect(screen.getByRole('button', { name: 'Fetch' })).toHaveClass('px-2', 'rounded', 'text-sm');
  });

  it('does not light up on hover while disabled', () => {
    render(<DropdownItem disabled>Pull</DropdownItem>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('enabled:hover:bg-surface1');
    expect(btn).not.toHaveClass('hover:bg-surface1');
  });

  it('applies the accent tone', () => {
    render(<DropdownItem tone="accent">Add</DropdownItem>);
    expect(screen.getByRole('button')).toHaveClass('text-blue');
    expect(screen.getByRole('button')).not.toHaveClass('text-text');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<DropdownItem onClick={onClick}>Item</DropdownItem>);
    screen.getByRole('button').click();
    expect(onClick).toHaveBeenCalled();
  });
});

describe('DropdownRow', () => {
  it('shares the row shape and hovers', () => {
    const { container } = render(<DropdownRow>row</DropdownRow>);
    expect(container.firstChild).toHaveClass('px-2', 'rounded', 'text-sm', 'hover:bg-surface1');
  });
});
