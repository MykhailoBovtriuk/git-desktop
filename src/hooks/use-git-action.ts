import { useTranslation } from 'react-i18next';
import { useUiStore } from '../stores/ui-store';
import { useAccountStore } from '../stores/account-store';
import { CheckoutConflictError, MergeConflictError, useRepoStore } from '../stores/repo-store';
import { classifyGitError } from '../lib/git-error-mapper';
import { errorMessage } from '../lib/error-message';

interface GitActionOptions {
  title: string;
  success?: string;
}

export function useGitAction() {
  const { t } = useTranslation('footer');
  const addToast = useUiStore(s => s.addToast);
  const openSignIn = useAccountStore(s => s.openSignIn);
  const remoteHost = useRepoStore(s => s.remoteHost);
  const remoteProtocol = useRepoStore(s => s.remoteProtocol);
  // A stored token authenticates an https remote and nothing else, so an ssh
  // repository gets the message without an offer that could not have helped.
  const signInHost = remoteProtocol === 'https' ? remoteHost : null;

  return async (fn: () => Promise<unknown>, opts: GitActionOptions): Promise<boolean> => {
    try {
      await fn();
      if (opts.success) {
        addToast({ variant: 'success', title: opts.title, message: opts.success });
      }
      return true;
    } catch (err: unknown) {
      // Both conflict errors mean a dedicated modal is already on screen:
      // neither a success nor an error toast belongs next to it.
      if (err instanceof CheckoutConflictError || err instanceof MergeConflictError) return false;
      const raw = errorMessage(err);
      const { kind, action } = classifyGitError(err);
      const friendly = t(`error.${kind}`);
      addToast({
        variant: 'error',
        title: opts.title,
        message: friendly || raw,
        // An auth failure is a dead end without somewhere to go: offer the
        // sign-in that would fix it, already aimed at the right server.
        action:
          action === 'signIn' && signInHost
            ? { label: t('signIn'), onClick: () => void openSignIn(signInHost) }
            : undefined,
      });
      return false;
    }
  };
}
