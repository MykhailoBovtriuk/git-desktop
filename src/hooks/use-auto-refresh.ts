import { useEffect } from 'react';
import { useRepoStore } from '../stores/repo-store';

export function useAutoRefresh() {
  const repoPath = useRepoStore(s => s.repoPath);
  useEffect(() => {
    if (!repoPath) return;
    const id = setInterval(() => useRepoStore.getState().refresh(), 30_000);
    return () => clearInterval(id);
  }, [repoPath]);
}
