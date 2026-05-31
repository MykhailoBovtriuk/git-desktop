// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from '../../../src/shared/ui/Badge';

describe('Badge', () => {
  it('renders ref variant', () => {
    render(<Badge variant="ref">main</Badge>);
    expect(screen.getByText('main')).toHaveClass('bg-surface0', 'text-blue');
  });

  it('renders beta variant', () => {
    render(<Badge variant="beta">Beta</Badge>);
    expect(screen.getByText('Beta')).toHaveClass('bg-peach/20', 'text-peach');
  });

  it('renders count variant', () => {
    render(<Badge variant="count">3</Badge>);
    expect(screen.getByText('3')).toHaveClass('rounded-full');
  });

  it('merges extra className with variant', () => {
    render(<Badge variant="ref" className="extra">x</Badge>);
    const el = screen.getByText('x');
    expect(el).toHaveClass('bg-surface0');
    expect(el).toHaveClass('extra');
  });

  it('count variant displays its children', () => {
    render(<Badge variant="count">42</Badge>);
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
