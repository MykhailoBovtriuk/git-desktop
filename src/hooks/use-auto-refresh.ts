import { useEffect } from 'react';
import { useRepoStore } from '../stores/repo-store';

// Coalesce a burst of file events (one git command touches many refs/objects)
// into a single refresh.
const DEBOUNCE_MS = 300;
// Safety-net poll only: real-time updates come from the main-process watcher via
// onGitChanged. Long interval so it barely runs — it exists to recover if the
// watcher misses an event (recursive watch unsupported on a platform, an editor
// writing through an unusual path).
const FALLBACK_POLL_MS = 60_000;

export function useAutoRefresh() {
  const repoPath = useRepoStore(s => s.repoPath);
  useEffect(() => {
    if (!repoPath) return;

    // Stand aside while a tracked operation (commit/checkout/merge/…) runs —
    // refreshing mid-operation would surface a stale, half-applied snapshot.
    const refreshIfIdle = () => {
      const state = useRepoStore.getState();
      if (state.busyOperation) return;
      state.refresh();
    };

    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(refreshIfIdle, DEBOUNCE_MS);
    };

    // Event-driven refresh: the main process watches the open repo's .git and
    // pushes on any change, so external commits/checkouts reflect within ~1s.
    // Optional-chained so the hook is inert under test (no electronAPI in jsdom).
    const unsubscribe = window.electronAPI?.onGitChanged?.(scheduleRefresh);
    const pollId = setInterval(refreshIfIdle, FALLBACK_POLL_MS);

    return () => {
      unsubscribe?.();
      clearInterval(pollId);
      if (debounce) clearTimeout(debounce);
    };
  }, [repoPath]);
}
