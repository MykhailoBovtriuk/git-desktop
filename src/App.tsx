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

  // Sign-in completes in the main process after a browser round trip, so the
  // result is pushed rather than returned. Without this subscription the modal
  // would sit on "waiting" forever even though the account is already stored.
  useEffect(() => {
    const load = async () => {
      await useAccountStore.getState().loadAccounts();
      // The footer shows the account for this repository's host, not merely
      // that some account exists — so point it at the freshly loaded list, or
      // signing in leaves the footer still claiming nobody is signed in.
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
