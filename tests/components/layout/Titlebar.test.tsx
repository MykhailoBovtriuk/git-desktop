// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../src/stores/repo-store', () => ({
  useRepoStore: vi.fn(),
}));
vi.mock('../../../src/components/dropdowns/BranchDropdown', () => ({
  BranchDropdown: () => null,
}));
vi.mock('../../../src/components/dropdowns/RepoDropdown', () => ({
  RepoDropdown: () => null,
}));

import { Titlebar } from '../../../src/components/layout/Titlebar';
import { useRepoStore } from '../../../src/stores/repo-store';

const refresh = vi.fn().mockResolvedValue(undefined);
const loadStatus = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  refresh.mockClear();
  loadStatus.mockClear();
  vi.mocked(useRepoStore).mockReturnValue({
    currentBranch: 'main',
    repoPath: '/home/me/project',
    mergeState: null,
    lastRefreshError: null,
    refresh,
    loadStatus,
  } as any);
});

describe('Titlebar', () => {
  it('refresh button triggers a full refresh', async () => {
    render(<Titlebar />);
    fireEvent.click(screen.getByLabelText('checkForChanges'));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('refresh button does not fall back to a status-only reload', () => {
    render(<Titlebar />);
    fireEvent.click(screen.getByLabelText('checkForChanges'));
    expect(loadStatus).not.toHaveBeenCalled();
  });

  it('shows a refresh-error indicator when the last refresh failed', () => {
    vi.mocked(useRepoStore).mockReturnValue({
      currentBranch: 'main',
      repoPath: '/home/me/project',
      mergeState: null,
      lastRefreshError: 'could not resolve host',
      refresh,
      loadStatus,
    } as any);
    render(<Titlebar />);
    const indicator = screen.getByLabelText('refreshError');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute('title', 'could not resolve host');
  });

  it('hides the refresh-error indicator when the last refresh succeeded', () => {
    render(<Titlebar />);
    expect(screen.queryByLabelText('refreshError')).not.toBeInTheDocument();
  });
});
