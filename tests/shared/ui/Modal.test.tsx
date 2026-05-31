// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Modal } from '../../../src/shared/ui/Modal';

describe('Modal', () => {
  it('renders title and children', () => {
    render(
      <Modal title="Hello">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('applies overlay z-index based on level prop', () => {
    const { container } = render(<Modal title="x" level="low">y</Modal>);
    expect(container.firstChild).toHaveClass('z-40');
  });

  it('renders red title when titleVariant=danger', () => {
    render(<Modal title="Oops" titleVariant="danger">y</Modal>);
    expect(screen.getByText('Oops')).toHaveClass('text-red');
  });

  it('renders footer slot when provided', () => {
    render(<Modal title="x" footer={<span>FOOT</span>}>y</Modal>);
    expect(screen.getByText('FOOT')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<Modal title="T" subtitle="Sub text">y</Modal>);
    expect(screen.getByText('Sub text')).toBeInTheDocument();
  });

  it('applies z-50 by default (level=high)', () => {
    const { container } = render(<Modal title="T">y</Modal>);
    expect(container.firstChild).toHaveClass('z-50');
  });

  it('applies custom width class', () => {
    render(<Modal title="T" width="w-80">y</Modal>);
    const inner = document.querySelector('.w-80');
    expect(inner).not.toBeNull();
  });

  it('does not render footer div when footer is undefined', () => {
    const { container } = render(<Modal title="T">y</Modal>);
    expect(container.querySelector('.justify-end')).toBeNull();
  });
});
