import { create } from 'zustand';
import { logApi } from '../api/log-api';
import type { LogEntry } from '../types';

export const LOG_MEMORY_CAP = 1000;
const PAGE = 200;

interface LogState {
  repoPath: string | null;
  entries: LogEntry[];
  hasMore: boolean;
  loadingMore: boolean;
  unreadProblems: number;
  unreadHasError: boolean;
  focusId: string | null;
  upsert: (entry: LogEntry, panelOpen: boolean) => void;
  load: (repoPath: string | null) => Promise<void>;
  loadOlder: () => Promise<void>;
  clear: (scope?: ClearScope) => Promise<void>;
  markRead: () => void;
  setFocus: (id: string | null) => void;
}

export type ClearScope = 'all' | 'repo' | 'app';

export const isProblem = (e: LogEntry) => e.status === 'error' || e.status === 'warning';

function merge(current: LogEntry[], incoming: LogEntry[]): LogEntry[] {
  const byId = new Map(current.map(e => [e.id, e]));
  for (const e of incoming) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => a.ts - b.ts);
}

export const useLogStore = create<LogState>()((set, get) => ({
  repoPath: null,
  entries: [],
  hasMore: false,
  loadingMore: false,
  unreadProblems: 0,
  unreadHasError: false,
  focusId: null,

  upsert: (entry, panelOpen) =>
    set(s => {
      // The app's own entries show next to whichever repository is open.
      if (entry.repoPath !== s.repoPath && entry.repoPath !== null) return s;
      const index = s.entries.findIndex(e => e.id === entry.id);
      const settledAsError = isProblem(entry) && (index < 0 || !isProblem(s.entries[index]));
      let entries: LogEntry[];
      if (index >= 0) {
        entries = s.entries.slice();
        entries[index] = entry;
      } else {
        entries = merge(s.entries, [entry]);
      }
      const overflow = entries.length - LOG_MEMORY_CAP;
      return {
        entries: overflow > 0 ? entries.slice(overflow) : entries,
        hasMore: s.hasMore || overflow > 0,
        unreadProblems: settledAsError && !panelOpen ? s.unreadProblems + 1 : s.unreadProblems,
        unreadHasError:
          s.unreadHasError || (settledAsError && !panelOpen && entry.status === 'error'),
      };
    }),

  load: async repoPath => {
    set({
      repoPath,
      entries: [],
      hasMore: false,
      unreadProblems: 0,
      unreadHasError: false,
      focusId: null,
    });
    const page = await logApi.list(repoPath, undefined, PAGE);
    if (get().repoPath !== repoPath) return;
    set(s => ({ entries: merge(s.entries, page), hasMore: page.length === PAGE }));
  },

  loadOlder: async () => {
    const { repoPath, entries, loadingMore, hasMore } = get();
    if (loadingMore || !hasMore) return;
    set({ loadingMore: true });
    try {
      const page = await logApi.list(repoPath, entries[0]?.ts, PAGE);
      if (get().repoPath !== repoPath) return;
      set(s => ({ entries: merge(s.entries, page), hasMore: page.length === PAGE }));
    } finally {
      set({ loadingMore: false });
    }
  },

  clear: async (scope = 'all') => {
    const { repoPath } = get();
    if (repoPath && scope !== 'app') await logApi.clear(repoPath);
    if (scope !== 'repo') await logApi.clear(null);
    if (scope === 'all') {
      set({ entries: [], hasMore: false, unreadProblems: 0, unreadHasError: false, focusId: null });
      return;
    }
    const gone = scope === 'app' ? null : repoPath;
    set(s => ({ entries: s.entries.filter(e => e.repoPath !== gone) }));
  },

  markRead: () => set({ unreadProblems: 0, unreadHasError: false }),

  setFocus: id => set({ focusId: id }),
}));
