import { useEffect } from 'react';
import './i18n/config';
import { useAutoRefresh } from './hooks/use-auto-refresh';
import { useTheme } from './hooks/use-theme';
import { useUpdateCheck } from './hooks/use-update-check';
import { Shell } from './components/layout/Shell';
import { accountApi } from './api/account-api';
import { useAccountStore } from './stores/account-store';
import { useRepoStore } from './stores/repo-store';

export default function App() {
  useTheme();
  useAutoRefresh();
  useUpdateCheck();

  // Sign-in finishes in the main process, so the result is pushed; without this
  // the modal would wait forever.
  useEffect(() => {
    const load = async () => {
      await useAccountStore.getState().loadAccounts();
      // Point the footer at the fresh list, or it keeps saying nobody is signed
      // in.
      const { remoteHost, remoteProtocol } = useRepoStore.getState();
      useAccountStore.getState().refreshCurrent(remoteHost);
      // Signing out has to take the footer's answer with it, or it goes on
      // claiming the system keychain has this covered.
      await useAccountStore.getState().refreshAuthSource(remoteHost, remoteProtocol);
    };
    const run = () => void load().catch(() => {});
    run();
    return accountApi.onAccountChanged(run);
  }, []);

  return <Shell />;
}
