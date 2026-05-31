// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../../src/shared/ui/Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('applies primary variant classes', () => {
    render(<Button variant="primary">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-blue', 'text-mantle');
  });

  it('applies secondary variant classes', () => {
    render(<Button variant="secondary">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('text-subtext');
  });

  it('applies danger variant classes', () => {
    render(<Button variant="danger">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-red/20', 'text-red');
  });

  it('forwards onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>x</Button>);
    screen.getByRole('button').click();
    expect(onClick).toHaveBeenCalled();
  });

  it('respects disabled', () => {
    render(<Button disabled>x</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies surface variant classes', () => {
    render(<Button variant="surface">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-surface0', 'text-text');
  });

  it('applies sm size classes', () => {
    render(<Button size="sm">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-2', 'py-1', 'text-xs');
  });

  it('applies w-full when fullWidth', () => {
    render(<Button fullWidth>x</Button>);
    expect(screen.getByRole('button')).toHaveClass('w-full');
  });

  it('merges extra className with variant classes', () => {
    render(<Button variant="primary" className="my-custom">x</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('bg-blue');
    expect(btn).toHaveClass('my-custom');
  });
});
