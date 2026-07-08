// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
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
    getWorkingDiff: vi.fn(),
    getStagedDiff: vi.fn(),
    getFileDiff: vi.fn(),
  },
}));

import { DiffViewer } from '../../../src/components/diff/DiffViewer';
import { useUiStore } from '../../../src/stores/ui-store';
import { useRepoStore } from '../../../src/stores/repo-store';
import { gitApi } from '../../../src/api/git-api';

const repoState = {
  status: {
    staged: [],
    unstaged: [{ path: 'a.txt', status: 'M', staged: false }],
  },
};

const uiState = {
  selectedFile: 'a.txt',
  selectedFileArea: 'unstaged',
  selectedCommit: null,
  activeView: 'changes',
};

beforeEach(() => {
  vi.clearAllMocks();
  uiState.selectedFile = 'a.txt';
  uiState.selectedFileArea = 'unstaged';
  repoState.status = { staged: [], unstaged: [{ path: 'a.txt', status: 'M', staged: false }] };
  vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(uiState)) as any);
  // Selector-aware: DiffViewer derives isStaged/inChanges via selectors.
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
});

describe('DiffViewer', () => {
  it('shows an error message when the diff fails to load', async () => {
    vi.mocked(gitApi.getWorkingDiff).mockRejectedValue(new Error('boom'));
    render(<DiffViewer />);
    await waitFor(() => expect(screen.getByText('loadFailed')).toBeInTheDocument());
  });

  it('does not show the error message when the diff loads successfully', async () => {
    vi.mocked(gitApi.getWorkingDiff).mockResolvedValue('');
    render(<DiffViewer />);
    // Empty diff → "noDiffToDisplay", never the failure message.
    await waitFor(() => expect(screen.getByText('noDiffToDisplay')).toBeInTheDocument());
    expect(screen.queryByText('loadFailed')).not.toBeInTheDocument();
  });

  // Regression: a partially staged file sits in BOTH lists; the diff source
  // must follow the list the user clicked in, not "staged wins".
  describe('partially staged file', () => {
    beforeEach(() => {
      repoState.status = {
        staged: [{ path: 'a.txt', status: 'M', staged: true }] as any,
        unstaged: [{ path: 'a.txt', status: 'M', staged: false }],
      };
    });

    it('clicking in the unstaged list shows the working diff', async () => {
      uiState.selectedFileArea = 'unstaged';
      vi.mocked(gitApi.getWorkingDiff).mockResolvedValue('');
      render(<DiffViewer />);
      await waitFor(() => expect(gitApi.getWorkingDiff).toHaveBeenCalledWith('a.txt'));
      expect(gitApi.getStagedDiff).not.toHaveBeenCalled();
    });

    it('clicking in the staged list shows the staged diff', async () => {
      uiState.selectedFileArea = 'staged';
      vi.mocked(gitApi.getStagedDiff).mockResolvedValue('');
      render(<DiffViewer />);
      await waitFor(() => expect(gitApi.getStagedDiff).toHaveBeenCalledWith('a.txt'));
      expect(gitApi.getWorkingDiff).not.toHaveBeenCalled();
    });
  });

  it('preserves indentation with whitespace-pre on diff line content', async () => {
    vi.mocked(gitApi.getWorkingDiff).mockResolvedValue(
      'diff --git a/a.txt b/a.txt\nindex abc..def 100644\n--- a/a.txt\n+++ b/a.txt\n@@ -1,1 +1,1 @@\n+    indented',
    );
    render(<DiffViewer />);
    const line = await screen.findByText(/indented/);
    expect(line.className).toContain('whitespace-pre');
  });
});
