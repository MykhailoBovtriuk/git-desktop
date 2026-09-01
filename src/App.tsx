import { useEffect } from 'react';
import './i18n/config';
import { useAutoRefresh } from './hooks/use-auto-refresh';
import { useTheme } from './hooks/use-theme';
import { Shell } from './components/layout/Shell';
import { accountApi } from './api/account-api';
import { useAccountStore } from './stores/account-store';
import { useRepoStore } from './stores/repo-store';

export default function App() {
  useTheme();
  useAutoRefresh();

  // Sign-in completes in the main process after a browser round trip, so the
  // result is pushed rather than returned. Without this subscription the modal
  // would sit on "waiting" forever even though the account is already stored.
  useEffect(() => {
    const load = async () => {
      await useAccountStore.getState().loadAccounts();
      // The footer shows the open repository's own account, not merely that
      // some account exists — so the binding has to be re-read too, or signing
      // in leaves the footer still claiming nobody is signed in.
      const { repoPath, remoteHost } = useRepoStore.getState();
      if (repoPath && remoteHost) {
        await useAccountStore.getState().refreshCurrent(repoPath, remoteHost);
      }
    };
    const run = () => void load().catch(() => {});
    run();
    return accountApi.onAccountChanged(run);
  }, []);

  return <Shell />;
}
