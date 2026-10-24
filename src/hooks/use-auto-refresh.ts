import { useEffect } from 'react';
import { useRepoStore } from '../stores/repo-store';
import { useSettingsStore } from '../stores/settings-store';
import { gitApi } from '../api/git-api';

const DEBOUNCE_MS = 300;

export function useAutoRefresh() {
  const repoPath = useRepoStore(s => s.repoPath);
  const pollMs = useSettingsStore(s => s.autoRefreshMs);
  useEffect(() => {
    if (!repoPath) return;

    const refreshIfIdle = () => {
      const state = useRepoStore.getState();
      if (state.busyCount > 0) return;
      state.refresh();
    };

    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(refreshIfIdle, DEBOUNCE_MS);
    };

    const unsubscribe = gitApi.onGitChanged(scheduleRefresh);
    const pollId = pollMs > 0 ? setInterval(refreshIfIdle, pollMs) : null;

    return () => {
      unsubscribe?.();
      if (pollId !== null) clearInterval(pollId);
      if (debounce) clearTimeout(debounce);
    };
  }, [repoPath, pollMs]);
}
