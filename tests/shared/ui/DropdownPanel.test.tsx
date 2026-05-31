// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DropdownPanel } from '../../../src/shared/ui/DropdownPanel';

describe('DropdownPanel', () => {
  it('renders children', () => {
    const { getByText } = render(
      <DropdownPanel>
        <span>panel content</span>
      </DropdownPanel>,
    );
    expect(getByText('panel content')).toBeInTheDocument();
  });

  it('align="center" applies class left-1/2 and -translate-x-1/2', () => {
    const { container } = render(
      <DropdownPanel align="center">content</DropdownPanel>,
    );
    const div = container.firstChild as HTMLElement;
    expect(div).toHaveClass('left-1/2');
    expect(div).toHaveClass('-translate-x-1/2');
  });

  it('align="right" applies class right-0', () => {
    const { container } = render(
      <DropdownPanel align="right">content</DropdownPanel>,
    );
    const div = container.firstChild as HTMLElement;
    expect(div).toHaveClass('right-0');
  });

  it('default width is w-64', () => {
    const { container } = render(<DropdownPanel>content</DropdownPanel>);
    expect(container.firstChild).toHaveClass('w-64');
  });

  it('custom width="w-48" applies w-48', () => {
    const { container } = render(
      <DropdownPanel width="w-48">content</DropdownPanel>,
    );
    expect(container.firstChild).toHaveClass('w-48');
  });

  it('extra className merges with base classes', () => {
    const { container } = render(
      <DropdownPanel className="extra-class">content</DropdownPanel>,
    );
    const div = container.firstChild as HTMLElement;
    expect(div).toHaveClass('bg-surface0');
    expect(div).toHaveClass('extra-class');
  });
});
