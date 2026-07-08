// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/ui-store', () => ({
  useUiStore: vi.fn(),
}));
vi.mock('../../../src/stores/repo-store', () => ({
  useRepoStore: vi.fn(),
}));
vi.mock('../../../src/api/git-api', () => ({
  gitApi: {
    getCommitDiff: vi.fn(),
  },
}));
// Children pull their own store/api dependencies; they are not under test.
vi.mock('../../../src/components/history/CommitList', () => ({
  CommitList: () => <div data-testid="commit-list" />,
}));
vi.mock('../../../src/components/diff/DiffViewer', () => ({
  DiffViewer: () => <div data-testid="diff-viewer" />,
}));

import { HistoryView } from '../../../src/components/history/HistoryView';
import { useUiStore } from '../../../src/stores/ui-store';
import { useRepoStore } from '../../../src/stores/repo-store';
import { gitApi } from '../../../src/api/git-api';

const setActiveView = vi.fn();
const setSelectedFile = vi.fn();
const addToast = vi.fn();

const commit = (hash: string) => ({
  hash,
  abbreviatedHash: hash.slice(0, 7),
  message: `Commit ${hash}`,
  author: 'Test',
  date: new Date().toISOString(),
  parents: [],
  refs: [],
});

const repoState = { commits: [commit('A'), commit('B')] };

function mockUiState(selectedCommit: string | null, selectedFile: string | null) {
  const state = { setActiveView, selectedCommit, setSelectedFile, selectedFile, addToast };
  vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(state)) as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(gitApi.getCommitDiff).mockResolvedValue([]);
  // Selector-aware: HistoryView derives commits via a selector.
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
});

describe('HistoryView', () => {
  it('resets the selected file when the selected commit changes', async () => {
    mockUiState('A', 'old.txt');
    const { rerender } = render(<HistoryView />);
    await waitFor(() => expect(gitApi.getCommitDiff).toHaveBeenCalledWith('A'));

    setSelectedFile.mockClear();
    mockUiState('B', 'old.txt');
    rerender(<HistoryView />);

    await waitFor(() => expect(setSelectedFile).toHaveBeenCalledWith(null));
  });

  it('does not reset the selected file on rerenders with the same commit', async () => {
    mockUiState('A', 'old.txt');
    const { rerender } = render(<HistoryView />);
    await waitFor(() => expect(gitApi.getCommitDiff).toHaveBeenCalledWith('A'));

    setSelectedFile.mockClear();
    rerender(<HistoryView />);

    expect(setSelectedFile).not.toHaveBeenCalled();
  });
});
