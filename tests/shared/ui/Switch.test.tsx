// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Switch } from '../../../src/shared/ui/Switch';

describe('Switch', () => {
  it('exposes the switch role with its checked state', () => {
    const { rerender } = render(<Switch checked={false} onToggle={() => {}} label="Auto" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    rerender(<Switch checked={true} onToggle={() => {}} label="Auto" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('renders the label text', () => {
    render(<Switch checked={false} onToggle={() => {}} label="Auto-commit" />);
    expect(screen.getByText('Auto-commit')).toBeInTheDocument();
  });

  it('calls onToggle on click', () => {
    const onToggle = vi.fn();
    render(<Switch checked={false} onToggle={onToggle} label="Auto" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
