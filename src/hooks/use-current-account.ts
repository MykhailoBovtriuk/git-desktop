import { useAccountStore } from '../stores/account-store';
import { useRepoStore } from '../stores/repo-store';

export function useCurrentAccount() {
  const repoPath = useRepoStore(s => s.repoPath);
  return useAccountStore(s => s.accountFor(repoPath));
}
