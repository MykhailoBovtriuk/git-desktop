// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../../src/stores/repo-store', () => ({
  useRepoStore: vi.fn(),
}));
vi.mock('../../../src/stores/ui-store', () => ({
  useUiStore: vi.fn(),
}));
vi.mock('../../../src/api/git-api', () => ({
  gitApi: { getStashDiff: vi.fn().mockResolvedValue('') },
}));
vi.mock('../../../src/components/stash/StashList', () => ({
  StashList: () => <div data-testid="stash-list" />,
}));
vi.mock('../../../src/components/stash/RawDiff', () => ({
  RawDiff: ({ raw }: { raw: string }) => <div data-testid="raw-diff">{raw}</div>,
}));

import { StashView } from '../../../src/components/stash/StashView';
import { useRepoStore } from '../../../src/stores/repo-store';
import { useUiStore } from '../../../src/stores/ui-store';

const baseRepo = {
  stashes: [],
  stashApply: vi.fn().mockResolvedValue(undefined),
  stashPop: vi.fn().mockResolvedValue(undefined),
  stashDrop: vi.fn().mockResolvedValue(undefined),
};
const baseUi = {
  selectedStash: null,
  setSelectedStash: vi.fn(),
  addToast: vi.fn(),
};

describe('StashView', () => {
  it('renders StashList panel', () => {
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue(baseUi as any);
    render(<StashView />);
    expect(screen.getByTestId('stash-list')).toBeInTheDocument();
  });

  it('shows noStashesYet hint when list is empty and nothing selected', () => {
    vi.mocked(useRepoStore).mockReturnValue(baseRepo as any);
    vi.mocked(useUiStore).mockReturnValue(baseUi as any);
    render(<StashView />);
    expect(screen.getByText('noStashesYet')).toBeInTheDocument();
  });

  it('shows selectStashHint when stashes exist but none selected', () => {
    vi.mocked(useRepoStore).mockReturnValue({
      ...baseRepo,
      stashes: [{ index: 0, message: 'x', branch: 'main', date: new Date().toISOString() }],
    } as any);
    vi.mocked(useUiStore).mockReturnValue(baseUi as any);
    render(<StashView />);
    expect(screen.getByText('selectStashHint')).toBeInTheDocument();
  });
});

// Regression: selection is a bare index — after a drop every index shifts and
// the selection silently pointed at a DIFFERENT stash (worse: drop+save keeps
// the length, so even the length-based diff refetch missed the swap).
describe('StashView selection stability', () => {
  const stash = (msg: string, date: string) => ({ index: 0, message: msg, branch: 'main', date });

  const setup = (stashes: unknown[], selectedStash: number | null) => {
    const repoState = { ...baseRepo, stashes };
    const uiState = { selectedStash, setSelectedStash: vi.fn(), addToast: vi.fn() };
    vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
    vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(uiState)) as any);
    return { repoState, uiState };
  };

  it('remaps the selection when stashes above it are removed', () => {
    const a = stash('wip A', '2024-01-01');
    const b = stash('wip B', '2024-01-02');
    const c = stash('wip C', '2024-01-03');
    const { repoState, uiState } = setup([a, b, c], 2); // C selected

    const { rerender } = render(<StashView />);
    repoState.stashes = [b, c]; // A dropped elsewhere — C is now index 1
    rerender(<StashView />);

    expect(uiState.setSelectedStash).toHaveBeenCalledWith(1);
  });

  it('clears the selection when the selected stash no longer exists', () => {
    const { repoState, uiState } = setup([stash('wip A', '2024-01-01')], 0);

    const { rerender } = render(<StashView />);
    repoState.stashes = [stash('wip D', '2024-02-02')]; // same length, different stash
    rerender(<StashView />);

    expect(uiState.setSelectedStash).toHaveBeenCalledWith(null);
  });
});
