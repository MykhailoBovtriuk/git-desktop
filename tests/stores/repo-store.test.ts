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
    getStashList: vi.fn().mockResolvedValue([]),
    stashSave: vi.fn().mockResolvedValue(null),
    stashApply: vi.fn().mockResolvedValue(null),
    stashPop: vi.fn().mockResolvedValue(null),
    stashDrop: vi.fn().mockResolvedValue(null),
    getStashDiff: vi.fn().mockResolvedValue(''),
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

  it('recentRepos is capped at 10 entries', async () => {
    for (let i = 0; i < 11; i++) {
      await useRepoStore.getState().openRepo(`/tmp/repo-${i}`);
    }
    expect(useRepoStore.getState().recentRepos.length).toBeLessThanOrEqual(10);
  });

  it('most recently opened repo appears first in recentRepos', async () => {
    await useRepoStore.getState().openRepo('/tmp/repo-first');
    await useRepoStore.getState().openRepo('/tmp/repo-second');
    expect(useRepoStore.getState().recentRepos[0]).toBe('/tmp/repo-second');
  });

  it('loadStashes populates stashes array', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    (gitApi.getStashList as any).mockResolvedValueOnce([
      { index: 0, message: 'WIP on main: x', branch: 'main', date: '2024-01-01T00:00:00Z' },
    ]);
    await useRepoStore.getState().openRepo('/tmp/test-repo');
    await useRepoStore.getState().loadStashes();
    expect(useRepoStore.getState().stashes).toHaveLength(1);
  });

  it('loadStashes returns silently when no repoPath', async () => {
    useRepoStore.setState({ repoPath: null, stashes: [] } as any);
    await useRepoStore.getState().loadStashes();
    expect(useRepoStore.getState().stashes).toHaveLength(0);
  });

  it('loadStashes handles errors gracefully', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    await useRepoStore.getState().openRepo('/tmp/test-repo');
    (gitApi.getStashList as any).mockRejectedValueOnce(new Error('boom'));
    await useRepoStore.getState().loadStashes();
    expect(useRepoStore.getState().stashes).toEqual([]);
  });

  it('stashSave calls gitApi.stashSave', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    await useRepoStore.getState().openRepo('/tmp/test-repo');
    await useRepoStore.getState().stashSave('my work');
    expect(gitApi.stashSave).toHaveBeenCalledWith('my work');
  });

  it('stashApply calls gitApi.stashApply with index', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    await useRepoStore.getState().openRepo('/tmp/test-repo');
    await useRepoStore.getState().stashApply(3);
    expect(gitApi.stashApply).toHaveBeenCalledWith(3);
  });

  it('stashPop calls gitApi.stashPop with index', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    await useRepoStore.getState().openRepo('/tmp/test-repo');
    await useRepoStore.getState().stashPop(0);
    expect(gitApi.stashPop).toHaveBeenCalledWith(0);
  });

  it('stashDrop calls gitApi.stashDrop with index', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    await useRepoStore.getState().openRepo('/tmp/test-repo');
    await useRepoStore.getState().stashDrop(1);
    expect(gitApi.stashDrop).toHaveBeenCalledWith(1);
  });
});
