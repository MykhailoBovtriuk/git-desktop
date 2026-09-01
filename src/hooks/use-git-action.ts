import { useTranslation } from 'react-i18next';
import { useUiStore } from '../stores/ui-store';
import { useAccountStore } from '../stores/account-store';
import { CheckoutConflictError, useRepoStore } from '../stores/repo-store';
import { classifyGitError } from '../lib/git-error-mapper';

interface GitActionOptions {
  title: string;
  success?: string;
}

export function useGitAction() {
  const { t } = useTranslation('footer');
  const addToast = useUiStore(s => s.addToast);
  const openSignIn = useAccountStore(s => s.openSignIn);
  const remoteHost = useRepoStore(s => s.remoteHost);

  return async (fn: () => Promise<unknown>, opts: GitActionOptions): Promise<boolean> => {
    try {
      await fn();
      if (opts.success) {
        addToast({ variant: 'success', title: opts.title, message: opts.success });
      }
      return true;
    } catch (err: unknown) {
      if (err instanceof CheckoutConflictError) return false;
      const raw = err instanceof Error ? err.message : String(err);
      const { kind, action } = classifyGitError(err);
      const friendly = t(`error.${kind}`);
      addToast({
        variant: 'error',
        title: opts.title,
        message: friendly || raw,
        // An auth failure is a dead end without somewhere to go: offer the
        // sign-in that would fix it, already aimed at the right server.
        action:
          action === 'signIn' && remoteHost
            ? { label: t('signIn'), onClick: () => void openSignIn(remoteHost) }
            : undefined,
      });
      return false;
    }
  };
}
