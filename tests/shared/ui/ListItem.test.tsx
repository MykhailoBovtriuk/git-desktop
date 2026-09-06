// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListItem } from '../../../src/shared/ui/ListItem';

describe('ListItem', () => {
  it('applies selected classes when selected=true', () => {
    render(
      <ListItem selected data-testid="li">
        x
      </ListItem>,
    );
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
    render(
      <ListItem onClick={onClick} data-testid="li">
        x
      </ListItem>,
    );
    screen.getByTestId('li').click();
    expect(onClick).toHaveBeenCalled();
  });

  it('merges extra className', () => {
    render(
      <ListItem data-testid="li" className="extra">
        x
      </ListItem>,
    );
    expect(screen.getByTestId('li')).toHaveClass('extra');
  });

  // Every list in the app rides on this component, so a clickable row that
  // the keyboard cannot reach is an app-wide accessibility hole.
  it('clickable rows are focusable buttons that react to Enter and Space', () => {
    const onClick = vi.fn();
    render(
      <ListItem onClick={onClick} data-testid="li">
        x
      </ListItem>,
    );
    const el = screen.getByTestId('li');
    expect(el).toHaveAttribute('role', 'button');
    expect(el).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(el, { key: 'Enter' });
    fireEvent.keyDown(el, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('non-clickable rows stay out of the tab order', () => {
    render(<ListItem data-testid="li">x</ListItem>);
    const el = screen.getByTestId('li');
    expect(el).not.toHaveAttribute('role');
    expect(el).not.toHaveAttribute('tabindex');
  });

  it('idle state includes hover:bg-surface0', () => {
    render(<ListItem data-testid="li">x</ListItem>);
    expect(screen.getByTestId('li')).toHaveClass('hover:bg-surface0');
  });
});
