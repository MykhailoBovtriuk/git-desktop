// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TextInput } from '../../../src/shared/ui/TextInput';

describe('TextInput', () => {
  it('renders placeholder', () => {
    render(<TextInput placeholder="Search" />);
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
  });

  it('search variant uses mantle background', () => {
    render(<TextInput variant="search" placeholder="x" />);
    expect(screen.getByPlaceholderText('x')).toHaveClass('bg-mantle');
  });

  it('filter variant uses surface0 background', () => {
    render(<TextInput variant="filter" placeholder="x" />);
    expect(screen.getByPlaceholderText('x')).toHaveClass('bg-surface0');
  });

  it('modal variant has border-surface1', () => {
    render(<TextInput variant="modal" placeholder="x" />);
    expect(screen.getByPlaceholderText('x')).toHaveClass('border-surface1');
  });

  it('calls onChange when value changes', () => {
    const onChange = vi.fn();
    render(<TextInput placeholder="x" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('x'), { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('forwards disabled attribute', () => {
    render(<TextInput placeholder="x" disabled />);
    expect(screen.getByPlaceholderText('x')).toBeDisabled();
  });

  it('merges extra className with variant', () => {
    render(<TextInput variant="search" placeholder="x" className="extra" />);
    const input = screen.getByPlaceholderText('x');
    expect(input).toHaveClass('bg-mantle');
    expect(input).toHaveClass('extra');
  });
});
