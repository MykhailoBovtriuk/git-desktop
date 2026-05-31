// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IconButton } from '../../../src/shared/ui/IconButton';

describe('IconButton', () => {
  it('applies green tint', () => {
    render(<IconButton tint="green" aria-label="stage">+</IconButton>);
    expect(screen.getByRole('button')).toHaveClass('text-green');
  });

  it('applies red tint', () => {
    render(<IconButton tint="red" aria-label="discard">x</IconButton>);
    expect(screen.getByRole('button')).toHaveClass('text-red');
  });

  it('applies hover background', () => {
    render(<IconButton tint="yellow" aria-label="unstage">-</IconButton>);
    expect(screen.getByRole('button')).toHaveClass('hover:bg-surface1');
  });

  it('applies blue tint', () => {
    render(<IconButton tint="blue" aria-label="x">i</IconButton>);
    expect(screen.getByRole('button')).toHaveClass('text-blue');
  });

  it('applies subtext tint by default', () => {
    render(<IconButton aria-label="x">i</IconButton>);
    expect(screen.getByRole('button')).toHaveClass('text-subtext');
  });

  it('merges extra className', () => {
    render(<IconButton tint="green" aria-label="x" className="extra">i</IconButton>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('text-green');
    expect(btn).toHaveClass('extra');
  });
});
