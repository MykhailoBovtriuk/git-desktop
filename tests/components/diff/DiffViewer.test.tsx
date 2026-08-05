// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/ui-store', () => ({
  useUiStore: vi.fn(),
}));
vi.mock('../../../src/stores/repo-store', () => ({
  useRepoStore: vi.fn(),
  // useGitAction (pulled in for hunk staging) imports this.
  CheckoutConflictError: class CheckoutConflictError extends Error {},
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

const stageHunk = vi.fn().mockResolvedValue(undefined);
const unstageHunk = vi.fn().mockResolvedValue(undefined);

const repoState = {
  epoch: 0,
  stageHunk,
  unstageHunk,
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
  addToast: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  uiState.selectedFile = 'a.txt';
  uiState.selectedFileArea = 'unstaged';
  uiState.activeView = 'changes';
  uiState.selectedCommit = null;
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

  describe('hunk staging', () => {
    const RAW =
      'diff --git a/a.txt b/a.txt\nindex 1111111..2222222 100644\n--- a/a.txt\n+++ b/a.txt\n@@ -1,1 +1,1 @@\n-old\n+new\n';

    it('offers "Stage hunk" for an unstaged file and stages the sliced patch', async () => {
      uiState.selectedFileArea = 'unstaged';
      vi.mocked(gitApi.getWorkingDiff).mockResolvedValue(RAW);
      render(<DiffViewer />);

      const btn = await screen.findByText('stageHunk');
      fireEvent.click(btn);

      await waitFor(() => expect(stageHunk).toHaveBeenCalledTimes(1));
      const patch = stageHunk.mock.calls[0][0] as string;
      expect(patch).toContain('--- a/a.txt');
      expect(patch).toContain('+new');
      expect(unstageHunk).not.toHaveBeenCalled();
    });

    it('offers "Unstage hunk" for a staged file and reverses the sliced patch', async () => {
      uiState.selectedFileArea = 'staged';
      repoState.status = {
        staged: [{ path: 'a.txt', status: 'M', staged: true }] as any,
        unstaged: [],
      };
      vi.mocked(gitApi.getStagedDiff).mockResolvedValue(RAW);
      render(<DiffViewer />);

      const btn = await screen.findByText('unstageHunk');
      fireEvent.click(btn);

      await waitFor(() => expect(unstageHunk).toHaveBeenCalledTimes(1));
      expect(stageHunk).not.toHaveBeenCalled();
    });

    it('hides hunk actions when viewing a historical commit', async () => {
      uiState.activeView = 'history';
      uiState.selectedCommit = 'abc1234' as any;
      vi.mocked(gitApi.getFileDiff).mockResolvedValue(RAW);
      render(<DiffViewer />);

      // The hunk renders, but with no stage/unstage affordance.
      await waitFor(() => expect(screen.getByText(/@@ -1,1/)).toBeInTheDocument());
      expect(screen.queryByText('stageHunk')).not.toBeInTheDocument();
      expect(screen.queryByText('unstageHunk')).not.toBeInTheDocument();
      uiState.activeView = 'changes';
      uiState.selectedCommit = null;
    });
  });

  it('preserves indentation with whitespace-pre on diff line content', async () => {
    vi.mocked(gitApi.getWorkingDiff).mockResolvedValue(
      'diff --git a/a.txt b/a.txt\nindex abc..def 100644\n--- a/a.txt\n+++ b/a.txt\n@@ -1,1 +1,1 @@\n+    indented',
    );
    render(<DiffViewer />);
    const line = await screen.findByText(/indented/);
    // Content now sits inside a whitespace-pre wrapper (the +/- prefix is a
    // sibling span); indentation is preserved as long as an ancestor sets it.
    expect(line.closest('.whitespace-pre')).not.toBeNull();
  });
});
