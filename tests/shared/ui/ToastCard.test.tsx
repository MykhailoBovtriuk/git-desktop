// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastCard } from '../../../src/shared/ui/ToastCard';

describe('ToastCard', () => {
  it('renders title and message', () => {
    render(<ToastCard variant="success" title="Saved" message="OK" onDismiss={() => {}} />);
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('applies success border', () => {
    const { container } = render(<ToastCard variant="success" title="t" message="m" onDismiss={() => {}} />);
    expect(container.firstChild).toHaveClass('border-green');
  });

  it('applies error border', () => {
    const { container } = render(<ToastCard variant="error" title="t" message="m" onDismiss={() => {}} />);
    expect(container.firstChild).toHaveClass('border-red');
  });

  it('calls onDismiss when close button clicked', () => {
    const onDismiss = vi.fn();
    render(<ToastCard variant="info" title="t" message="m" onDismiss={onDismiss} />);
    screen.getByRole('button').click();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('applies info border color', () => {
    const { container } = render(<ToastCard variant="info" title="t" message="m" onDismiss={() => {}} />);
    expect(container.firstChild).toHaveClass('border-blue');
  });

  it('renders action button when action provided', () => {
    render(<ToastCard variant="success" title="t" message="m" onDismiss={() => {}} action={{ label: 'Undo', onClick: () => {} }} />);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('calls action.onClick when action button clicked', () => {
    const onClick = vi.fn();
    render(<ToastCard variant="success" title="t" message="m" onDismiss={() => {}} action={{ label: 'Undo', onClick }} />);
    screen.getByRole('button', { name: 'Undo' }).click();
    expect(onClick).toHaveBeenCalled();
  });

  it('does not render action button when action is undefined', () => {
    render(<ToastCard variant="success" title="t" message="m" onDismiss={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
