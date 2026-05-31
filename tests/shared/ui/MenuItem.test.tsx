// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MenuItem } from '../../../src/shared/ui/MenuItem';

describe('MenuItem', () => {
  it('renders as a button with correct classes', () => {
    render(<MenuItem>Click</MenuItem>);
    const btn = screen.getByRole('button', { name: 'Click' });
    expect(btn).toHaveClass('w-full', 'text-left', 'text-xs');
  });

  it('applies destructive tint', () => {
    render(<MenuItem tone="danger">Delete</MenuItem>);
    expect(screen.getByRole('button')).toHaveClass('text-red');
  });

  it('applies text-text for default tone', () => {
    render(<MenuItem>Item</MenuItem>);
    expect(screen.getByRole('button')).toHaveClass('text-text');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<MenuItem onClick={onClick}>Item</MenuItem>);
    screen.getByRole('button').click();
    expect(onClick).toHaveBeenCalled();
  });

  it('merges extra className', () => {
    render(<MenuItem className="extra">Item</MenuItem>);
    expect(screen.getByRole('button')).toHaveClass('extra');
  });
});
