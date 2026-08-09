// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
    const { container } = render(
      <Modal title="x" level="low">
        y
      </Modal>,
    );
    expect(container.firstChild).toHaveClass('z-40');
  });

  it('renders red title when titleVariant=danger', () => {
    render(
      <Modal title="Oops" titleVariant="danger">
        y
      </Modal>,
    );
    expect(screen.getByText('Oops')).toHaveClass('text-red');
  });

  it('renders footer slot when provided', () => {
    render(
      <Modal title="x" footer={<span>FOOT</span>}>
        y
      </Modal>,
    );
    expect(screen.getByText('FOOT')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(
      <Modal title="T" subtitle="Sub text">
        y
      </Modal>,
    );
    expect(screen.getByText('Sub text')).toBeInTheDocument();
  });

  it('applies z-50 by default (level=high)', () => {
    const { container } = render(<Modal title="T">y</Modal>);
    expect(container.firstChild).toHaveClass('z-50');
  });

  it('applies custom width class', () => {
    render(
      <Modal title="T" width="w-80">
        y
      </Modal>,
    );
    const inner = document.querySelector('.w-80');
    expect(inner).not.toBeNull();
  });

  it('does not render footer div when footer is undefined', () => {
    const { container } = render(<Modal title="T">y</Modal>);
    expect(container.querySelector('.justify-end')).toBeNull();
  });

  // P3.21 — accessibility
  it('exposes the dialog role and aria-modal', () => {
    render(<Modal title="T">y</Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('labels the dialog by its title via aria-labelledby', () => {
    render(<Modal title="My Dialog">y</Modal>);
    const dialog = screen.getByRole('dialog');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)).toHaveTextContent('My Dialog');
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(
      <Modal title="T" onClose={onClose}>
        y
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not throw on Escape when onClose is absent', () => {
    render(<Modal title="T">y</Modal>);
    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow();
  });

  it('moves focus into the dialog on mount', () => {
    render(<Modal title="T">y</Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveFocus();
  });

  // Focus trap: Tab must not escape to elements behind the overlay.
  it('wraps Tab from the last focusable element back to the first', () => {
    render(
      <>
        <button>outside</button>
        <Modal title="T" footer={<button>last</button>}>
          <button>first</button>
        </Modal>
      </>,
    );
    const first = screen.getByText('first');
    const last = screen.getByText('last');
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('wraps Shift+Tab from the first focusable element back to the last', () => {
    render(
      <>
        <button>outside</button>
        <Modal title="T" footer={<button>last</button>}>
          <button>first</button>
        </Modal>
      </>,
    );
    const first = screen.getByText('first');
    const last = screen.getByText('last');
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('pulls focus back into the panel when Tab is pressed while focus is outside', () => {
    render(
      <>
        <button>outside</button>
        <Modal title="T" footer={<button>last</button>}>
          <button>first</button>
        </Modal>
      </>,
    );
    const outside = screen.getByText('outside');
    outside.focus();
    fireEvent.keyDown(outside, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByText('first'));
  });
});
