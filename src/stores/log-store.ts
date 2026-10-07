import { create } from 'zustand';
import { logApi } from '../api/log-api';
import type { LogEntry } from '../types';

/** In memory at once; older pages come back from disk on request. */
export const LOG_MEMORY_CAP = 1000;
const PAGE = 200;

interface LogState {
  /** The repository the entries belong to; the panel shows no other. */
  repoPath: string | null;
  /** Oldest first, the way a terminal scrolls. */
  entries: LogEntry[];
  hasMore: boolean;
  loadingMore: boolean;
  /** Failures that arrived while the panel was closed. */
  unreadErrors: number;
  /** The entry the panel should open and scroll to. */
  focusId: string | null;
  upsert: (entry: LogEntry, panelOpen: boolean) => void;
  /** Switches to `repoPath`'s log: drops the previous one and loads the newest page. */
  load: (repoPath: string | null) => Promise<void>;
  loadOlder: () => Promise<void>;
  clear: () => Promise<void>;
  markRead: () => void;
  focusLatestError: () => void;
  setFocus: (id: string | null) => void;
}

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
  unreadErrors: 0,
  focusId: null,

  upsert: (entry, panelOpen) =>
    set(s => {
      if (entry.repoPath !== s.repoPath) return s;
      const index = s.entries.findIndex(e => e.id === entry.id);
      const settledAsError =
        entry.status === 'error' && (index < 0 || s.entries[index].status !== 'error');
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
        unreadErrors: settledAsError && !panelOpen ? s.unreadErrors + 1 : s.unreadErrors,
      };
    }),

  load: async repoPath => {
    set({ repoPath, entries: [], hasMore: false, unreadErrors: 0, focusId: null });
    if (!repoPath) return;
    const page = await logApi.list(repoPath, undefined, PAGE);
    // Another repository may have been opened while this page was on its way.
    if (get().repoPath !== repoPath) return;
    set(s => ({ entries: merge(s.entries, page), hasMore: page.length === PAGE }));
  },

  loadOlder: async () => {
    const { repoPath, entries, loadingMore, hasMore } = get();
    if (!repoPath || loadingMore || !hasMore) return;
    set({ loadingMore: true });
    try {
      const page = await logApi.list(repoPath, entries[0]?.ts, PAGE);
      if (get().repoPath !== repoPath) return;
      set(s => ({ entries: merge(s.entries, page), hasMore: page.length === PAGE }));
    } finally {
      set({ loadingMore: false });
    }
  },

  clear: async () => {
    const { repoPath } = get();
    if (!repoPath) return;
    await logApi.clear(repoPath);
    set({ entries: [], hasMore: false, unreadErrors: 0, focusId: null });
  },

  markRead: () => set({ unreadErrors: 0 }),

  focusLatestError: () => {
    const latest = [...get().entries].reverse().find(e => e.status === 'error');
    set({ focusId: latest?.id ?? null });
  },

  setFocus: id => set({ focusId: id }),
}));
