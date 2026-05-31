// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionLabel } from '../../../src/shared/ui/SectionLabel';

describe('SectionLabel', () => {
  it('renders children text', () => {
    render(<SectionLabel>Branch</SectionLabel>);
    expect(screen.getByText('Branch')).toBeInTheDocument();
  });

  it('has class text-subtext', () => {
    render(<SectionLabel>Branch</SectionLabel>);
    expect(screen.getByText('Branch')).toHaveClass('text-subtext');
  });

  it('has class uppercase', () => {
    render(<SectionLabel>Branch</SectionLabel>);
    expect(screen.getByText('Branch')).toHaveClass('uppercase');
  });

  it('has class tracking-wide', () => {
    render(<SectionLabel>Branch</SectionLabel>);
    expect(screen.getByText('Branch')).toHaveClass('tracking-wide');
  });

  it('extra className merges with base classes', () => {
    render(<SectionLabel className="extra-class">Label</SectionLabel>);
    const el = screen.getByText('Label');
    expect(el).toHaveClass('text-subtext');
    expect(el).toHaveClass('extra-class');
  });
});
