// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/ui-store', () => ({
  useUiStore: vi.fn((sel: any) => sel({ addToast: vi.fn() })),
}));
vi.mock('../../../src/stores/repo-store', () => ({
  useRepoStore: vi.fn(),
  // useGitAction imports this; provide a real class so instanceof checks work.
  CheckoutConflictError: class CheckoutConflictError extends Error {},
}));

import { RebaseBanner } from '../../../src/components/rebase/RebaseBanner';
import { useRepoStore } from '../../../src/stores/repo-store';

const abortRebase = vi.fn().mockResolvedValue(undefined);
const continueRebase = vi.fn().mockResolvedValue(undefined);

const repoState = {
  rebasing: true,
  status: { staged: [], unstaged: [{ path: 'a.txt', status: 'U', staged: false }] },
  abortRebase,
  continueRebase,
};

beforeEach(() => {
  vi.clearAllMocks();
  repoState.rebasing = true;
  repoState.status = { staged: [], unstaged: [{ path: 'a.txt', status: 'U', staged: false }] };
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
});

describe('RebaseBanner', () => {
  it('renders nothing when not rebasing', () => {
    repoState.rebasing = false;
    const { container } = render(<RebaseBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the conflict count from unmerged status entries while rebasing', () => {
    render(<RebaseBanner />);
    expect(screen.getByText('rebaseConflict')).toBeInTheDocument();
    // conflictingFilesCount is rendered (one 'U' file present).
    expect(screen.getByText('conflictingFilesCount')).toBeInTheDocument();
  });

  it('falls back to the generic rebasing message when there are no conflicts', () => {
    repoState.status = { staged: [], unstaged: [] };
    render(<RebaseBanner />);
    expect(screen.getByText('rebasing')).toBeInTheDocument();
  });

  it('clicking Abort invokes abortRebase', () => {
    render(<RebaseBanner />);
    fireEvent.click(screen.getByText('abortRebase'));
    expect(abortRebase).toHaveBeenCalled();
  });

  it('clicking Continue invokes continueRebase', () => {
    render(<RebaseBanner />);
    fireEvent.click(screen.getByText('continueRebase'));
    expect(continueRebase).toHaveBeenCalled();
  });
});
