// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommitForm } from '../../../src/components/staging/CommitForm';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';

vi.mock('react-i18next', () => ({
  // error.unknown is empty in the real footer namespace — unclassified errors
  // must fall back to the raw git message.
  useTranslation: () => ({ t: (k: string) => (k === 'error.unknown' ? '' : k) }),
}));
vi.mock('../../../src/stores/repo-store', () => ({
  useRepoStore: vi.fn(),
  CheckoutConflictError: class CheckoutConflictError extends Error {},
}));
vi.mock('../../../src/stores/ui-store', () => ({ useUiStore: vi.fn() }));

function setupMocks({
  staged = ['file.ts'],
  commitImpl = vi.fn().mockResolvedValue(undefined),
}: {
  staged?: string[];
  commitImpl?: ReturnType<typeof vi.fn>;
} = {}) {
  const mockCommit = commitImpl;
  const mockAddToast = vi.fn();

  // Selector-aware: CommitForm and useGitAction both select from the stores.
  const repoState = {
    commit: mockCommit,
    status: { staged: staged.map(p => ({ path: p })), unstaged: [] },
    merging: false,
  };
  const uiState = { addToast: mockAddToast };
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
  vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(uiState)) as any);

  return { mockCommit, mockAddToast };
}

describe('CommitForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('commit button is disabled when message is empty', () => {
    setupMocks({ staged: ['file.ts'] });
    render(<CommitForm />);
    expect(screen.getByRole('button', { name: 'commitButton' })).toBeDisabled();
  });

  it('commit button is disabled when no staged files', () => {
    setupMocks({ staged: [] });
    render(<CommitForm />);
    const textarea = screen.getByPlaceholderText('commitMessage');
    fireEvent.change(textarea, { target: { value: 'some message' } });
    expect(screen.getByRole('button', { name: 'commitButton' })).toBeDisabled();
  });

  it('commit button is enabled when message is non-empty and staged files exist', () => {
    setupMocks({ staged: ['file.ts'] });
    render(<CommitForm />);
    const textarea = screen.getByPlaceholderText('commitMessage');
    fireEvent.change(textarea, { target: { value: 'my commit' } });
    expect(screen.getByRole('button', { name: 'commitButton' })).not.toBeDisabled();
  });

  it('counter shows "0/100" initially', () => {
    setupMocks();
    render(<CommitForm />);
    expect(screen.getByText('0/100')).toBeInTheDocument();
  });

  it('counter shows correct count after typing', () => {
    setupMocks();
    render(<CommitForm />);
    const textarea = screen.getByPlaceholderText('commitMessage');
    fireEvent.change(textarea, { target: { value: 'hello' } });
    expect(screen.getByText('5/100')).toBeInTheDocument();
  });

  it('counter has text-subtext class when at or below 100 chars', () => {
    setupMocks();
    render(<CommitForm />);
    const textarea = screen.getByPlaceholderText('commitMessage');
    fireEvent.change(textarea, { target: { value: 'a'.repeat(100) } });
    const counter = screen.getByText('100/100');
    expect(counter).toHaveClass('text-subtext');
    expect(counter).not.toHaveClass('text-red');
  });

  it('counter has text-red class when over 100 chars', () => {
    setupMocks();
    render(<CommitForm />);
    const textarea = screen.getByPlaceholderText('commitMessage');
    fireEvent.change(textarea, { target: { value: 'a'.repeat(101) } });
    const counter = screen.getByText('101/100');
    expect(counter).toHaveClass('text-red');
    expect(counter).not.toHaveClass('text-subtext');
  });

  it('Ctrl+Enter triggers commit', async () => {
    const { mockCommit, mockAddToast } = setupMocks({ staged: ['file.ts'] });
    render(<CommitForm />);
    const textarea = screen.getByPlaceholderText('commitMessage');
    fireEvent.change(textarea, { target: { value: 'my commit' } });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(mockCommit).toHaveBeenCalledWith('my commit'));
    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
  });

  it('Cmd+Enter triggers commit', async () => {
    const { mockCommit, mockAddToast } = setupMocks({ staged: ['file.ts'] });
    render(<CommitForm />);
    const textarea = screen.getByPlaceholderText('commitMessage');
    fireEvent.change(textarea, { target: { value: 'mac commit' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    await waitFor(() => expect(mockCommit).toHaveBeenCalledWith('mac commit'));
    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
  });

  it('on successful commit: clears message and calls addToast with variant success', async () => {
    const { mockCommit, mockAddToast } = setupMocks({ staged: ['file.ts'] });
    render(<CommitForm />);
    const textarea = screen.getByPlaceholderText('commitMessage');
    fireEvent.change(textarea, { target: { value: 'successful commit' } });
    fireEvent.click(screen.getByRole('button', { name: 'commitButton' }));
    await waitFor(() => expect(mockCommit).toHaveBeenCalledWith('successful commit'));
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success', title: 'committed' }),
    );
    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });

  it('on failed commit: calls addToast with variant error', async () => {
    const error = new Error('commit failed');
    const { mockAddToast } = setupMocks({
      staged: ['file.ts'],
      commitImpl: vi.fn().mockRejectedValue(error),
    });
    render(<CommitForm />);
    const textarea = screen.getByPlaceholderText('commitMessage');
    fireEvent.change(textarea, { target: { value: 'bad commit' } });
    fireEvent.click(screen.getByRole('button', { name: 'commitButton' }));
    await waitFor(() =>
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error', message: 'commit failed' }),
      ),
    );
  });
});
