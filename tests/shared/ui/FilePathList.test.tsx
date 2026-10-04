// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilePathList } from '../../../src/shared/ui/FilePathList';

const files = [{ path: 'src/deep/a.ts' }, { path: 'b.ts' }];

describe('FilePathList', () => {
  it('shows basenames and the full path in a tooltip on hover', () => {
    vi.useFakeTimers();
    render(<FilePathList files={files} selected={null} onSelect={() => {}} />);
    fireEvent.mouseEnter(screen.getByText('a.ts'));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('src/deep/a.ts');
    vi.useRealTimers();
  });

  it('shows no tooltip for a root-level file that fits', () => {
    vi.useFakeTimers();
    render(<FilePathList files={files} selected={null} onSelect={() => {}} />);
    fireEvent.mouseEnter(screen.getByText('b.ts'));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('reports selection with the full path, not the basename', () => {
    const onSelect = vi.fn();
    render(<FilePathList files={files} selected={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('a.ts'));
    expect(onSelect).toHaveBeenCalledWith('src/deep/a.ts');
  });

  it('highlights the selected file', () => {
    render(<FilePathList files={files} selected="b.ts" onSelect={() => {}} />);
    expect(screen.getByText('b.ts').closest('button')).toHaveClass('bg-surface1', 'border-blue');
    expect(screen.getByText('a.ts').closest('button')).toHaveClass('border-transparent');
  });

  it('renders children above the list (loading row)', () => {
    render(
      <FilePathList files={[]} selected={null} onSelect={() => {}}>
        <p>loading…</p>
      </FilePathList>,
    );
    expect(screen.getByText('loading…')).toBeInTheDocument();
  });
});
