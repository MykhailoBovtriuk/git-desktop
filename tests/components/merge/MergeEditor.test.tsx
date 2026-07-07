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
}));
vi.mock('../../../src/api/git-api', () => ({
  gitApi: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    markResolved: vi.fn(),
  },
}));

import { MergeEditor } from '../../../src/components/merge/MergeEditor';
import { useUiStore } from '../../../src/stores/ui-store';
import { useRepoStore } from '../../../src/stores/repo-store';
import { gitApi } from '../../../src/api/git-api';

const repoState = {
  mergeState: {
    sourceBranch: 'feature',
    targetBranch: 'main',
    conflictingFiles: ['a.txt'],
  },
  abortMerge: vi.fn(),
  refresh: vi.fn(),
  clearMergeState: vi.fn(),
  concludeMerge: vi.fn(),
};

const uiState = {
  activeMergeFile: 'a.txt',
  setActiveMergeFile: vi.fn(),
  setActiveView: vi.fn(),
  addToast: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRepoStore).mockImplementation(((sel: any) => sel(repoState)) as any);
  vi.mocked(useUiStore).mockImplementation(((sel: any) => sel(uiState)) as any);
});

const saveButton = () => screen.getByText('saveMarkResolved').closest('button')!;

describe('MergeEditor save guard', () => {
  // Regression: while readFile was in flight, segs fell back to [] so
  // remaining === 0 and Save was enabled — clicking it wrote rebuild([]) = ''
  // over the user's file and marked it resolved.
  it('disables Save while the file content is still loading', async () => {
    vi.mocked(gitApi.readFile).mockReturnValue(new Promise(() => {}));
    render(<MergeEditor />);

    expect(saveButton()).toBeDisabled();
    fireEvent.click(saveButton());
    expect(gitApi.writeFile).not.toHaveBeenCalled();
    expect(gitApi.markResolved).not.toHaveBeenCalled();
  });

  it('keeps Save disabled when the file failed to load', async () => {
    vi.mocked(gitApi.readFile).mockRejectedValue(new Error('read boom'));
    render(<MergeEditor />);

    await waitFor(() => expect(uiState.addToast).toHaveBeenCalled());
    expect(saveButton()).toBeDisabled();
    fireEvent.click(saveButton());
    expect(gitApi.writeFile).not.toHaveBeenCalled();
  });

  it('enables Save once content is loaded and no conflicts remain', async () => {
    vi.mocked(gitApi.readFile).mockResolvedValue('no conflicts here\njust text');
    render(<MergeEditor />);

    await waitFor(() => expect(saveButton()).not.toBeDisabled());
  });
});
