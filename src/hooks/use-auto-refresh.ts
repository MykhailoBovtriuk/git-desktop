import { useEffect } from 'react';
import { useRepoStore } from '../stores/repo-store';
import { useSettingsStore } from '../stores/settings-store';

const DEBOUNCE_MS = 300;

export function useAutoRefresh() {
  const repoPath = useRepoStore(s => s.repoPath);
  // The fallback poll covers changes the watcher can miss (another client
  // writing over a network share, a remote moving on). Users on quiet repos can
  // turn it off entirely; watcher-driven refreshes keep working either way.
  const pollMs = useSettingsStore(s => s.autoRefreshMs);
  useEffect(() => {
    if (!repoPath) return;

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

    const unsubscribe = window.electronAPI?.onGitChanged?.(scheduleRefresh);
    const pollId = pollMs > 0 ? setInterval(refreshIfIdle, pollMs) : null;

    return () => {
      unsubscribe?.();
      if (pollId !== null) clearInterval(pollId);
      if (debounce) clearTimeout(debounce);
    };
  }, [repoPath, pollMs]);
}
