import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/api/git-api', () => ({
  gitApi: {
    openRepo: vi.fn((p: string) => Promise.resolve(p)),
    openDialog: vi.fn().mockResolvedValue('/tmp/test-repo'),
    getLog: vi.fn().mockResolvedValue([]),
    getBranches: vi.fn().mockResolvedValue([{ name: 'main', current: true, remote: false }]),
    getStatus: vi.fn().mockResolvedValue({ staged: [], unstaged: [] }),
    stageFiles: vi.fn().mockResolvedValue(null),
    unstageFiles: vi.fn().mockResolvedValue(null),
    discardChanges: vi.fn().mockResolvedValue(null),
    commit: vi.fn().mockResolvedValue('abc123'),
    fetch: vi.fn().mockResolvedValue(null),
    pull: vi.fn().mockResolvedValue('1 change'),
    push: vi.fn().mockResolvedValue(null),
    pushSetUpstream: vi.fn().mockResolvedValue(null),
    checkout: vi.fn().mockResolvedValue(null),
    checkoutForce: vi.fn().mockResolvedValue(null),
    merge: vi.fn().mockResolvedValue({ success: true, conflicts: [] }),
    isMerging: vi.fn().mockResolvedValue(false),
    getMergeConflicts: vi.fn().mockResolvedValue([]),
    getMergeMessage: vi.fn().mockResolvedValue(''),
    rebase: vi.fn().mockResolvedValue(null),
    isRebasing: vi.fn().mockResolvedValue(false),
    abortRebase: vi.fn().mockResolvedValue(null),
    continueRebase: vi.fn().mockResolvedValue(null),
    deleteBranch: vi.fn().mockResolvedValue(null),
    abortMerge: vi.fn().mockResolvedValue(null),
    getStashList: vi.fn().mockResolvedValue([]),
    getStashTop: vi.fn().mockResolvedValue(null),
    stashSave: vi.fn().mockResolvedValue(null),
    stashApply: vi.fn().mockResolvedValue(null),
    stashPop: vi.fn().mockResolvedValue(null),
    stashDrop: vi.fn().mockResolvedValue(null),
    getStashDiff: vi.fn().mockResolvedValue(''),
  },
}));

const { useRepoStore, LOG_PAGE_SIZE } = await import('../../src/stores/repo-store');

const makeCommits = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    hash: `h${i}`,
    abbreviatedHash: `h${i}`,
    message: `c${i}`,
    author: 'a',
    date: '2024-01-01T00:00:00Z',
    parents: [],
    refs: [],
  }));

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
      hasMoreCommits: false,
      loadingMoreCommits: false,
      lastRefreshError: null,
      busyOperation: null,
    } as any);
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
    useRepoStore.setState({
      mergeState: { sourceBranch: 'feature', targetBranch: 'main', conflictingFiles: ['a.ts'] },
    });
    await useRepoStore.getState().abortMerge();
    expect(useRepoStore.getState().mergeState).toBeNull();
  });

  it('loadStatus reflects an in-progress rebase via isRebasing', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    (gitApi.isRebasing as any).mockResolvedValueOnce(true);
    useRepoStore.setState({ repoPath: '/tmp/test-repo' } as any);
    await useRepoStore.getState().loadStatus();
    expect(useRepoStore.getState().rebasing).toBe(true);
  });

  it('loadStatus defaults rebasing to false when isRebasing throws', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    (gitApi.isRebasing as any).mockRejectedValueOnce(new Error('old main process'));
    useRepoStore.setState({ repoPath: '/tmp/test-repo', rebasing: true } as any);
    await useRepoStore.getState().loadStatus();
    expect(useRepoStore.getState().rebasing).toBe(false);
  });

  it('abortRebase calls gitApi.abortRebase', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    useRepoStore.setState({ repoPath: '/tmp/test-repo' } as any);
    await useRepoStore.getState().abortRebase();
    expect(gitApi.abortRebase).toHaveBeenCalled();
  });

  it('continueRebase calls gitApi.continueRebase', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    useRepoStore.setState({ repoPath: '/tmp/test-repo' } as any);
    await useRepoStore.getState().continueRebase();
    expect(gitApi.continueRebase).toHaveBeenCalled();
  });

  it('continueRebase propagates errors (unresolved conflicts)', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    useRepoStore.setState({ repoPath: '/tmp/test-repo' } as any);
    (gitApi.continueRebase as any).mockRejectedValueOnce(
      new Error('needs merge / unmerged files'),
    );
    await expect(useRepoStore.getState().continueRebase()).rejects.toThrow(/unmerged/);
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
    (gitApi.getStashList as any).mockResolvedValue([
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
    // Manual stash flow forwards the `staged` flag; StashSection passes `true`,
    // the store action forwards whatever it receives (undefined here).
    expect(gitApi.stashSave).toHaveBeenCalledWith('my work', undefined);
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

  it('checkout passes a local branch name as-is', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    useRepoStore.setState({
      repoPath: '/tmp/test-repo',
      branches: [{ name: 'feature', current: false, remote: false }],
    } as any);
    await useRepoStore.getState().checkout('feature');
    expect(gitApi.checkout).toHaveBeenCalledWith('feature');
  });

  it('checkout strips the remote prefix so HEAD is not detached', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    useRepoStore.setState({
      repoPath: '/tmp/test-repo',
      branches: [{ name: 'origin/dev', current: false, remote: true }],
    } as any);
    await useRepoStore.getState().checkout('origin/dev');
    expect(gitApi.checkout).toHaveBeenCalledWith('dev');
  });

  it('checkout sets checkoutConflict and throws when local changes block it', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    const { CheckoutConflictError } = await import('../../src/stores/repo-store');
    useRepoStore.setState({ repoPath: '/tmp/test-repo', branches: [] } as any);
    (gitApi.checkout as any).mockRejectedValueOnce(
      new Error('Your local changes to the following files would be overwritten by checkout: a.ts'),
    );
    await expect(useRepoStore.getState().checkout('feature')).rejects.toBeInstanceOf(
      CheckoutConflictError,
    );
    expect(useRepoStore.getState().checkoutConflict).toEqual({ branch: 'feature' });
  });

  it('checkout rethrows non-conflict errors without setting checkoutConflict', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    useRepoStore.setState({
      repoPath: '/tmp/test-repo',
      branches: [],
      checkoutConflict: null,
    } as any);
    (gitApi.checkout as any).mockRejectedValueOnce(new Error('some other failure'));
    await expect(useRepoStore.getState().checkout('feature')).rejects.toThrow('some other failure');
    expect(useRepoStore.getState().checkoutConflict).toBeNull();
  });

  it('stashAndCheckout stashes then switches', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    useRepoStore.setState({
      repoPath: '/tmp/test-repo',
      checkoutConflict: { branch: 'feature' },
    } as any);
    await useRepoStore.getState().stashAndCheckout();
    expect(gitApi.stashSave).toHaveBeenCalled();
    expect(gitApi.checkout).toHaveBeenCalledWith('feature');
    expect(useRepoStore.getState().checkoutConflict).toBeNull();
  });

  it('migrateCheckout stashes, switches, then pops', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    useRepoStore.setState({
      repoPath: '/tmp/test-repo',
      checkoutConflict: { branch: 'feature' },
    } as any);
    // Empty stack before, a new stash after — proves a stash was created so the
    // pop targets our own stash@{0}, not a pre-existing one.
    (gitApi.getStashTop as any).mockResolvedValueOnce(null).mockResolvedValueOnce('newstashsha');
    await useRepoStore.getState().migrateCheckout();
    expect(gitApi.stashSave).toHaveBeenCalled();
    expect(gitApi.checkout).toHaveBeenCalledWith('feature');
    expect(gitApi.stashPop).toHaveBeenCalledWith(0);
    expect(useRepoStore.getState().checkoutConflict).toBeNull();
  });

  it('forceCheckout discards changes and switches', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    useRepoStore.setState({
      repoPath: '/tmp/test-repo',
      checkoutConflict: { branch: 'feature' },
    } as any);
    await useRepoStore.getState().forceCheckout();
    expect(gitApi.checkoutForce).toHaveBeenCalledWith('feature');
    expect(useRepoStore.getState().checkoutConflict).toBeNull();
  });

  it('cancelCheckout clears the conflict', () => {
    useRepoStore.setState({ checkoutConflict: { branch: 'feature' } } as any);
    useRepoStore.getState().cancelCheckout();
    expect(useRepoStore.getState().checkoutConflict).toBeNull();
  });

  // P4.26 — partial refresh: one failing loader must not discard the segments
  // that succeeded, and refresh itself must resolve (not reject).
  it('refresh keeps successful segments when one loader fails', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    useRepoStore.setState({ repoPath: '/tmp/test-repo' } as any);
    (gitApi.getLog as any).mockRejectedValueOnce(new Error('log boom'));
    (gitApi.getBranches as any).mockResolvedValueOnce([
      { name: 'dev', current: true, remote: false },
    ]);

    await expect(useRepoStore.getState().refresh()).resolves.toBeUndefined();

    expect(useRepoStore.getState().currentBranch).toBe('dev');
    expect(useRepoStore.getState().lastRefreshError).toContain('log boom');
  });

  it('refresh clears lastRefreshError when every loader succeeds', async () => {
    useRepoStore.setState({ repoPath: '/tmp/test-repo', lastRefreshError: 'stale' } as any);
    await useRepoStore.getState().refresh();
    expect(useRepoStore.getState().lastRefreshError).toBeNull();
  });

  // P4.25 — operation lock: a busyOperation marker is set for the duration of a
  // tracked operation so auto-refresh can stand aside.
  it('runOperation sets busyOperation while running and clears it after', async () => {
    let observed: string | null = 'unset';
    await useRepoStore.getState().runOperation('commit', async () => {
      observed = useRepoStore.getState().busyOperation;
    });
    expect(observed).toBe('commit');
    expect(useRepoStore.getState().busyOperation).toBeNull();
  });

  it('runOperation clears busyOperation even when the operation throws', async () => {
    await expect(
      useRepoStore.getState().runOperation('push', async () => {
        throw new Error('nope');
      }),
    ).rejects.toThrow('nope');
    expect(useRepoStore.getState().busyOperation).toBeNull();
  });

  it('runOperation returns the operation result', async () => {
    const result = await useRepoStore.getState().runOperation('pull', async () => '42 files');
    expect(result).toBe('42 files');
  });

  // P4.28 — pagination / load more
  it('loadLog caps to a page and flags hasMoreCommits when a full page+1 is returned', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    (gitApi.getLog as any).mockResolvedValueOnce(makeCommits(LOG_PAGE_SIZE + 1));
    await useRepoStore.getState().loadLog();
    expect(useRepoStore.getState().commits).toHaveLength(LOG_PAGE_SIZE);
    expect(useRepoStore.getState().hasMoreCommits).toBe(true);
  });

  it('loadLog clears hasMoreCommits when fewer than a page is returned', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    (gitApi.getLog as any).mockResolvedValueOnce(makeCommits(3));
    await useRepoStore.getState().loadLog();
    expect(useRepoStore.getState().commits).toHaveLength(3);
    expect(useRepoStore.getState().hasMoreCommits).toBe(false);
  });

  it('loadMoreCommits appends the next page and requests it at the current offset', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    useRepoStore.setState({ commits: makeCommits(LOG_PAGE_SIZE), hasMoreCommits: true } as any);
    (gitApi.getLog as any).mockResolvedValueOnce(makeCommits(2));
    await useRepoStore.getState().loadMoreCommits();
    expect(gitApi.getLog).toHaveBeenCalledWith(LOG_PAGE_SIZE + 1, LOG_PAGE_SIZE);
    expect(useRepoStore.getState().commits).toHaveLength(LOG_PAGE_SIZE + 2);
    expect(useRepoStore.getState().hasMoreCommits).toBe(false);
  });

  it('loadMoreCommits is a no-op when there are no more commits', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    useRepoStore.setState({ commits: makeCommits(5), hasMoreCommits: false } as any);
    await useRepoStore.getState().loadMoreCommits();
    expect(gitApi.getLog).not.toHaveBeenCalled();
    expect(useRepoStore.getState().commits).toHaveLength(5);
  });

  // P4.31 — publish branch (set upstream)
  it('publishBranch pushes the current branch upstream to origin', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    useRepoStore.setState({ repoPath: '/tmp/test-repo', currentBranch: 'feature' } as any);
    await useRepoStore.getState().publishBranch();
    expect(gitApi.pushSetUpstream).toHaveBeenCalledWith('origin', 'feature');
  });

  it('publishBranch throws when there is no current branch', async () => {
    useRepoStore.setState({ repoPath: '/tmp/test-repo', currentBranch: '' } as any);
    await expect(useRepoStore.getState().publishBranch()).rejects.toThrow();
  });
});

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

// Phase 2 — every loader captures a generation token; responses that resolve
// after the repo was switched or a mutation ran must be discarded.
describe('repo-store race conditions', () => {
  beforeEach(() => {
    useRepoStore.setState({
      repoPath: null,
      commits: [],
      branches: [],
      currentBranch: '',
      status: { staged: [], unstaged: [] },
      mergeState: null,
      merging: false,
      checkoutConflict: null,
      hasMoreCommits: false,
      loadingMoreCommits: false,
      busyOperation: null,
    } as any);
    vi.clearAllMocks();
  });

  it('discards log results that arrive after the repo was switched', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    const slow = deferred<unknown[]>();
    (gitApi.getLog as any)
      .mockImplementationOnce(() => slow.promise) // repo A — hangs
      .mockResolvedValueOnce(makeCommits(1)); // repo B — fresh
    const first = useRepoStore.getState().openRepo('/a');
    await useRepoStore.getState().openRepo('/b');
    slow.resolve(makeCommits(5)); // stale data for /a lands last
    await first;
    expect(useRepoStore.getState().commits).toHaveLength(1);
  });

  it('discards a refresh snapshot that started before a mutation', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    const slow = deferred<unknown>();
    (gitApi.getStatus as any).mockImplementationOnce(() => slow.promise);
    const stale = useRepoStore.getState().loadStatus();
    await useRepoStore.getState().runOperation('commit', async () => {});
    slow.resolve({
      staged: [{ path: 'ghost.txt', status: 'M', staged: true }],
      unstaged: [],
      ahead: 0,
      behind: 0,
    });
    await stale;
    expect(useRepoStore.getState().status.staged).toHaveLength(0);
  });

  it('keeps busyOperation set until every concurrent operation finishes', async () => {
    const g1 = deferred<void>();
    const g2 = deferred<void>();
    const op1 = useRepoStore.getState().runOperation('pull', () => g1.promise);
    const op2 = useRepoStore.getState().runOperation('checkout', () => g2.promise);
    g2.resolve();
    await op2;
    expect(useRepoStore.getState().busyOperation).not.toBeNull();
    g1.resolve();
    await op1;
    expect(useRepoStore.getState().busyOperation).toBeNull();
  });

  it('discards a "load more" page when the log was reloaded meanwhile', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    useRepoStore.setState({ commits: makeCommits(LOG_PAGE_SIZE), hasMoreCommits: true } as any);
    const slow = deferred<unknown[]>();
    (gitApi.getLog as any)
      .mockImplementationOnce(() => slow.promise) // load more — hangs
      .mockResolvedValueOnce(makeCommits(3)); // concurrent reload
    const more = useRepoStore.getState().loadMoreCommits();
    await useRepoStore.getState().loadLog();
    slow.resolve(makeCommits(10)); // stale next page for the old offset
    await more;
    expect(useRepoStore.getState().commits).toHaveLength(3);
  });

  it('coalesces concurrent refreshes into one round of loaders', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    useRepoStore.setState({ repoPath: '/tmp/test-repo' } as any);
    await Promise.all([useRepoStore.getState().refresh(), useRepoStore.getState().refresh()]);
    expect(gitApi.getLog).toHaveBeenCalledTimes(1);
  });
});

// Phase 2 — after a mutation, everything the mutation may have changed must
// be reloaded, and failure paths must still leave the UI in sync.
describe('repo-store state consistency', () => {
  beforeEach(() => {
    useRepoStore.setState({
      repoPath: '/tmp/test-repo',
      commits: [],
      branches: [],
      currentBranch: '',
      mergeState: null,
      merging: false,
      checkoutConflict: null,
      busyOperation: null,
    } as any);
    vi.clearAllMocks();
  });

  it('fetch reloads branches and log (new remote branches must appear)', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    await useRepoStore.getState().fetch();
    expect(gitApi.getBranches).toHaveBeenCalled();
    expect(gitApi.getLog).toHaveBeenCalled();
  });

  it('push reloads the log (remote ref badges must move)', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    await useRepoStore.getState().push();
    expect(gitApi.getLog).toHaveBeenCalled();
  });

  it('migrateCheckout refreshes even when the stash pop conflicts', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    useRepoStore.setState({ checkoutConflict: { branch: 'feature' } } as any);
    (gitApi.getStashTop as any).mockResolvedValueOnce(null).mockResolvedValueOnce('sha');
    (gitApi.stashPop as any).mockRejectedValueOnce(
      new Error('CONFLICT (content): merge conflict in a.ts'),
    );
    await expect(useRepoStore.getState().migrateCheckout()).rejects.toThrow(/CONFLICT/);
    // The branch DID switch before the pop failed — the UI must reflect it.
    expect(gitApi.getLog).toHaveBeenCalled();
    expect(gitApi.getBranches).toHaveBeenCalled();
  });

  it('openRepo reconstructs mergeState when the repo is mid-merge', async () => {
    const { gitApi } = await import('../../src/api/git-api');
    (gitApi.isMerging as any).mockResolvedValueOnce(true);
    (gitApi.getMergeConflicts as any).mockResolvedValueOnce(['a.ts']);
    (gitApi.getMergeMessage as any).mockResolvedValueOnce("Merge branch 'feature' into main");
    await useRepoStore.getState().openRepo('/tmp/test-repo');
    expect(useRepoStore.getState().mergeState).toMatchObject({
      sourceBranch: 'feature',
      targetBranch: 'main',
      conflictingFiles: ['a.ts'],
    });
  });

  it('openRepo leaves mergeState null when not merging', async () => {
    await useRepoStore.getState().openRepo('/tmp/test-repo');
    expect(useRepoStore.getState().mergeState).toBeNull();
  });
});
