// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StashForm } from '../../../src/components/stash/StashForm';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('StashForm', () => {
  it('renders textarea, Stash button and List toggle in create mode', () => {
    render(<StashForm canStash listMode={false} onStash={vi.fn()} onToggle={vi.fn()} />);
    expect(screen.getByPlaceholderText('messagePlaceholder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'stash' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'list' })).toBeInTheDocument();
  });

  it('renders nothing in list mode', () => {
    const { container } = render(<StashForm canStash listMode={true} onStash={vi.fn()} onToggle={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('Stash button disabled when canStash=false', () => {
    render(<StashForm canStash={false} listMode={false} onStash={vi.fn()} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'stash' })).toBeDisabled();
  });

  it('Stash button disabled when message is empty', () => {
    render(<StashForm canStash listMode={false} onStash={vi.fn()} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'stash' })).toBeDisabled();
  });

  it('calls onStash with trimmed message when Stash clicked', () => {
    const onStash = vi.fn();
    render(<StashForm canStash listMode={false} onStash={onStash} onToggle={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('messagePlaceholder'), { target: { value: '  my stash  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'stash' }));
    expect(onStash).toHaveBeenCalledWith('my stash');
  });

  it('clears message after onStash is called', () => {
    render(<StashForm canStash listMode={false} onStash={vi.fn()} onToggle={vi.fn()} />);
    const textarea = screen.getByPlaceholderText('messagePlaceholder');
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'stash' }));
    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });

  it('calls onToggle when List button clicked', () => {
    const onToggle = vi.fn();
    render(<StashForm canStash listMode={false} onStash={vi.fn()} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'list' }));
    expect(onToggle).toHaveBeenCalled();
  });
});
