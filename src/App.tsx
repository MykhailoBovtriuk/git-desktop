import { useEffect } from 'react';
import './i18n/config';
import { useAutoRefresh } from './hooks/use-auto-refresh';
import { useTheme } from './hooks/use-theme';
import { useUpdateCheck } from './hooks/use-update-check';
import { usePanelFeeds } from './hooks/use-panel-feeds';
import { Shell } from './components/layout/Shell';
import { accountApi } from './api/account-api';
import { useAccountStore } from './stores/account-store';
import { useRepoStore } from './stores/repo-store';

export default function App() {
  useTheme();
  useAutoRefresh();
  useUpdateCheck();
  usePanelFeeds();

  useEffect(() => {
    const load = async () => {
      await useAccountStore.getState().loadAccounts();
      const { repoPath, remoteHost, remoteProtocol } = useRepoStore.getState();
      useAccountStore.getState().refreshCurrent(repoPath);
      await useAccountStore.getState().refreshAuthSource(remoteHost, remoteProtocol, repoPath);
    };
    const run = () => void load().catch(() => {});
    run();
    return accountApi.onAccountChanged(run);
  }, []);

  return <Shell />;
}
