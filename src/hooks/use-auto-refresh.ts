import { useEffect } from 'react';
import { useRepoStore } from '../stores/repo-store';

const DEBOUNCE_MS = 300;
const FALLBACK_POLL_MS = 60_000;

export function useAutoRefresh() {
  const repoPath = useRepoStore(s => s.repoPath);
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
    const pollId = setInterval(refreshIfIdle, FALLBACK_POLL_MS);

    return () => {
      unsubscribe?.();
      clearInterval(pollId);
      if (debounce) clearTimeout(debounce);
    };
  }, [repoPath]);
}
