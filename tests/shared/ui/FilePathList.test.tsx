// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilePathList } from '../../../src/shared/ui/FilePathList';

const files = [{ path: 'src/deep/a.ts' }, { path: 'b.ts' }];

describe('FilePathList', () => {
  it('shows basenames but keeps the full path in the title', () => {
    render(<FilePathList files={files} selected={null} onSelect={() => {}} />);
    const btn = screen.getByText('a.ts');
    expect(btn).toHaveAttribute('title', 'src/deep/a.ts');
  });

  it('reports selection with the full path, not the basename', () => {
    const onSelect = vi.fn();
    render(<FilePathList files={files} selected={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('a.ts'));
    expect(onSelect).toHaveBeenCalledWith('src/deep/a.ts');
  });

  it('highlights the selected file', () => {
    render(<FilePathList files={files} selected="b.ts" onSelect={() => {}} />);
    expect(screen.getByText('b.ts')).toHaveClass('bg-surface1', 'border-blue');
    expect(screen.getByText('a.ts')).toHaveClass('border-transparent');
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
