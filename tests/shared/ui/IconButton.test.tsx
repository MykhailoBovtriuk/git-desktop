// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IconButton } from '../../../src/shared/ui/IconButton';
import { StageIcon } from '../../../src/shared/ui/icons';

describe('IconButton', () => {
  it('applies green tint', () => {
    render(<IconButton icon={StageIcon} tint="green" aria-label="stage" />);
    expect(screen.getByRole('button')).toHaveClass('text-green');
  });

  it('applies red tint', () => {
    render(<IconButton icon={StageIcon} tint="red" aria-label="discard" />);
    expect(screen.getByRole('button')).toHaveClass('text-red');
  });

  it('applies hover background', () => {
    render(<IconButton icon={StageIcon} tint="yellow" aria-label="unstage" />);
    expect(screen.getByRole('button')).toHaveClass('hover:bg-surface1');
  });

  it('applies blue tint', () => {
    render(<IconButton icon={StageIcon} tint="blue" aria-label="x" />);
    expect(screen.getByRole('button')).toHaveClass('text-blue');
  });

  it('applies subtext tint by default', () => {
    render(<IconButton icon={StageIcon} aria-label="x" />);
    expect(screen.getByRole('button')).toHaveClass('text-subtext');
  });

  it('merges extra className', () => {
    render(<IconButton icon={StageIcon} tint="green" aria-label="x" className="extra" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('text-green');
    expect(btn).toHaveClass('extra');
  });

  it('renders the icon as an svg hidden from screen readers', () => {
    render(<IconButton icon={StageIcon} aria-label="stage" />);
    const svg = screen.getByRole('button').querySelector('svg');
    expect(svg).not.toBeNull();
    // The button carries the accessible name; the glyph must not repeat it.
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('sizes the icon smaller in dense rows', () => {
    const { rerender } = render(<IconButton icon={StageIcon} aria-label="x" />);
    expect(screen.getByRole('button').querySelector('svg')).toHaveAttribute('height', '16');
    rerender(<IconButton icon={StageIcon} size="sm" aria-label="x" />);
    expect(screen.getByRole('button').querySelector('svg')).toHaveAttribute('height', '14');
  });

  it('spins only the icon, never the button surface', () => {
    render(<IconButton icon={StageIcon} spinning aria-label="refresh" />);
    const btn = screen.getByRole('button');
    expect(btn).not.toHaveClass('animate-spin');
    expect(btn.querySelector('svg')).toHaveClass('animate-spin');
  });
});
