import './i18n/config';
import { useEffect } from 'react';
import { useAutoRefresh } from './hooks/use-auto-refresh';
import { useRepoStore } from './stores/repo-store';
import { Shell } from './components/layout/Shell';

export default function App() {
  useAutoRefresh();

  const repoPath = useRepoStore(s => s.repoPath);
  useEffect(() => {
    if (repoPath) {
      useRepoStore.getState().openRepo(repoPath).catch(() => {
        useRepoStore.setState({ repoPath: null });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Shell />;
}
