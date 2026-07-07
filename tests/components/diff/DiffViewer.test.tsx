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

beforeEach(() => {
  vi.mocked(useUiStore).mockReturnValue({
    selectedFile: 'a.txt',
    selectedCommit: null,
    activeView: 'changes',
  } as any);
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
});
