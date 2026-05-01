import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/api/git-api', () => ({
  gitApi: {
    openRepo: vi.fn().mockResolvedValue(null),
    openDialog: vi.fn().mockResolvedValue('/tmp/test-repo'),
    getLog: vi.fn().mockResolvedValue([]),
    getBranches: vi.fn().mockResolvedValue([{ name: 'main', current: true, remote: false }]),
    getStatus: vi.fn().mockResolvedValue({ staged: [], unstaged: [] }),
    getAheadBehind: vi.fn().mockResolvedValue({ ahead: 0, behind: 0 }),
    stageFiles: vi.fn().mockResolvedValue(null),
    unstageFiles: vi.fn().mockResolvedValue(null),
    discardChanges: vi.fn().mockResolvedValue(null),
    commit: vi.fn().mockResolvedValue('abc123'),
    fetch: vi.fn().mockResolvedValue(null),
    pull: vi.fn().mockResolvedValue('1 change'),
    push: vi.fn().mockResolvedValue(null),
    checkout: vi.fn().mockResolvedValue(null),
    merge: vi.fn().mockResolvedValue({ success: true, conflicts: [] }),
    rebase: vi.fn().mockResolvedValue(null),
    deleteBranch: vi.fn().mockResolvedValue(null),
    abortMerge: vi.fn().mockResolvedValue(null),
  },
}));

const { useRepoStore } = await import('../../src/stores/repo-store');

describe('repo-store', () => {
  beforeEach(() => {
    useRepoStore.setState({
      repoPath: null,
      recentRepos: [],
      commits: [],
      branches: [],
      currentBranch: '',
      status: { staged: [], unstaged: [] },
      aheadBehind: { ahead: 0, behind: 0 },
      mergeState: null,
    });
    vi.clearAllMocks();
  });

  it('openRepo sets repoPath and adds to recentRepos', async () => {
    await useRepoStore.getState().openRepo('/tmp/test-repo');
    expect(useRepoStore.getState().repoPath).toBe('/tmp/test-repo');
    expect(useRepoStore.getState().recentRepos).toContain('/tmp/test-repo');
  });

  it('openRepo does not duplicate recentRepos', async () => {
    await useRepoStore.getState().openRepo('/tmp/test-repo');
    await useRepoStore.getState().openRepo('/tmp/test-repo');
    expect(useRepoStore.getState().recentRepos.length).toBe(1);
  });

  it('openDialog opens dialog and sets repo', async () => {
    await useRepoStore.getState().openDialog();
    expect(useRepoStore.getState().repoPath).toBe('/tmp/test-repo');
  });

  it('loadBranches sets branches and currentBranch', async () => {
    await useRepoStore.getState().loadBranches();
    expect(useRepoStore.getState().branches).toHaveLength(1);
    expect(useRepoStore.getState().currentBranch).toBe('main');
  });

  it('merge sets mergeState when conflicts exist', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    vi.mocked(gitApi.merge).mockResolvedValueOnce({ success: false, conflicts: ['src/foo.ts'] });
    useRepoStore.setState({ currentBranch: 'main' });
    await useRepoStore.getState().merge('feature');
    expect(useRepoStore.getState().mergeState).not.toBeNull();
    expect(useRepoStore.getState().mergeState?.conflictingFiles).toContain('src/foo.ts');
  });

  it('abortMerge clears mergeState', async () => {
    useRepoStore.setState({ mergeState: { sourceBranch: 'feature', targetBranch: 'main', conflictingFiles: ['a.ts'] } });
    await useRepoStore.getState().abortMerge();
    expect(useRepoStore.getState().mergeState).toBeNull();
  });
});
