import { useEffect } from 'react';
import { useRepoStore } from '../stores/repo-store';

export function useAutoRefresh() {
  const repoPath = useRepoStore(s => s.repoPath);
  useEffect(() => {
    if (!repoPath) return;
    const id = setInterval(() => {
      const state = useRepoStore.getState();
      // Stand aside while a tracked operation (commit/checkout/merge/…) runs —
      // refreshing mid-operation would surface a stale, half-applied snapshot.
      if (state.busyOperation) return;
      state.refresh();
    }, 30_000);
    return () => clearInterval(id);
  }, [repoPath]);
}
