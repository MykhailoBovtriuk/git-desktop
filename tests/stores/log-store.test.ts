import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LogEntry } from '../../src/types';

const list = vi.fn();
const clear = vi.fn();
vi.mock('../../src/api/log-api', () => ({ logApi: { list, clear } }));

const { useLogStore, LOG_MEMORY_CAP } = await import('../../src/stores/log-store');

function entry(id: string, ts: number, status: LogEntry['status'] = 'success'): LogEntry {
  return { id, ts, repoPath: '/r', op: 'push', status, commands: [] };
}

beforeEach(() => {
  list.mockReset();
  clear.mockReset().mockResolvedValue(null);
  useLogStore.setState({
    repoPath: '/r',
    entries: [],
    hasMore: false,
    loadingMore: false,
    unreadErrors: 0,
    focusId: null,
  });
});

describe('log store', () => {
  it('replaces a running entry with its outcome in place', () => {
    const { upsert } = useLogStore.getState();
    upsert(entry('a', 1, 'running'), false);
    upsert(entry('b', 2), false);
    upsert(entry('a', 1, 'error'), false);
    const { entries, unreadErrors } = useLogStore.getState();
    expect(entries.map(e => [e.id, e.status])).toEqual([
      ['a', 'error'],
      ['b', 'success'],
    ]);
    expect(unreadErrors).toBe(1);
  });

  it('does not count errors seen with the panel open, nor the same error twice', () => {
    const { upsert } = useLogStore.getState();
    upsert(entry('a', 1, 'error'), true);
    upsert(entry('a', 1, 'error'), false);
    expect(useLogStore.getState().unreadErrors).toBe(0);
  });

  it('keeps the newest entries within the memory cap', () => {
    const { upsert } = useLogStore.getState();
    for (let i = 0; i < LOG_MEMORY_CAP + 5; i++) upsert(entry(String(i), i), false);
    const { entries, hasMore } = useLogStore.getState();
    expect(entries).toHaveLength(LOG_MEMORY_CAP);
    expect(entries[0].id).toBe('5');
    expect(hasMore).toBe(true);
  });

  it('loads a repository’s log oldest first, dropping the previous one', async () => {
    useLogStore.setState({ entries: [entry('old', 5)], unreadErrors: 3 });
    list.mockResolvedValueOnce([
      { ...entry('b', 20), repoPath: '/other' },
      { ...entry('a', 10), repoPath: '/other' },
    ]);
    await useLogStore.getState().load('/other');
    expect(list).toHaveBeenCalledWith('/other', undefined, 200);
    const s = useLogStore.getState();
    expect(s.entries.map(e => e.id)).toEqual(['a', 'b']);
    expect(s.unreadErrors).toBe(0);
  });

  it('ignores live entries from other repositories', () => {
    useLogStore.getState().upsert({ ...entry('x', 1), repoPath: '/other' }, false);
    expect(useLogStore.getState().entries).toEqual([]);
  });

  it('drops a page that arrives after switching repositories', async () => {
    let resolve!: (v: LogEntry[]) => void;
    list.mockReturnValueOnce(new Promise(r => (resolve = r)));
    const pending = useLogStore.getState().load('/a');
    useLogStore.setState({ repoPath: '/b' });
    resolve([{ ...entry('late', 1), repoPath: '/a' }]);
    await pending;
    expect(useLogStore.getState().entries).toEqual([]);
  });

  it('pages older entries before the oldest loaded one', async () => {
    useLogStore.setState({ entries: [entry('b', 20)], hasMore: true });
    list.mockResolvedValueOnce([entry('a', 10)]);
    await useLogStore.getState().loadOlder();
    expect(list).toHaveBeenCalledWith('/r', 20, 200);
    expect(useLogStore.getState().entries.map(e => e.id)).toEqual(['a', 'b']);
    expect(useLogStore.getState().hasMore).toBe(false);
  });

  it('focuses the latest error', () => {
    useLogStore.setState({
      entries: [entry('a', 1, 'error'), entry('b', 2, 'error'), entry('c', 3)],
    });
    useLogStore.getState().focusLatestError();
    expect(useLogStore.getState().focusId).toBe('b');
  });

  it('clears through the main process', async () => {
    useLogStore.setState({ entries: [entry('a', 1)], unreadErrors: 2 });
    await useLogStore.getState().clear();
    expect(clear).toHaveBeenCalledWith('/r');
    expect(useLogStore.getState().entries).toEqual([]);
    expect(useLogStore.getState().unreadErrors).toBe(0);
  });
});
