// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListItem } from '../../../src/shared/ui/ListItem';

describe('ListItem', () => {
  it('applies selected classes when selected=true', () => {
    render(<ListItem selected data-testid="li">x</ListItem>);
    const el = screen.getByTestId('li');
    expect(el).toHaveClass('bg-surface1', 'border-blue');
  });

  it('applies idle classes when selected=false', () => {
    render(<ListItem data-testid="li">x</ListItem>);
    const el = screen.getByTestId('li');
    expect(el).toHaveClass('border-transparent');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<ListItem onClick={onClick} data-testid="li">x</ListItem>);
    screen.getByTestId('li').click();
    expect(onClick).toHaveBeenCalled();
  });

  it('merges extra className', () => {
    render(<ListItem data-testid="li" className="extra">x</ListItem>);
    expect(screen.getByTestId('li')).toHaveClass('extra');
  });

  it('idle state includes hover:bg-surface0', () => {
    render(<ListItem data-testid="li">x</ListItem>);
    expect(screen.getByTestId('li')).toHaveClass('hover:bg-surface0');
  });
});
