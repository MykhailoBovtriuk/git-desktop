import { useTranslation } from 'react-i18next';
import { useUiStore } from '../stores/ui-store';
import { useAccountStore } from '../stores/account-store';
import { useLogStore } from '../stores/log-store';
import { CheckoutConflictError, MergeConflictError, useRepoStore } from '../stores/repo-store';
import { selectSignInHost } from '../stores/repo/selectors';
import { classifyGitError } from '../lib/git-error-mapper';
import { errorMessage } from '../lib/error-message';

interface GitActionOptions<T> {
  /** Error toast title; also the success one unless `successTitle` is given. */
  title: string;
  successTitle?: string;
  success?: string | ((result: T) => string);
}

export function useGitAction() {
  const { t } = useTranslation('footer');
  const addToast = useUiStore(s => s.addToast);
  const openSignIn = useAccountStore(s => s.openSignIn);
  const signInHost = useRepoStore(selectSignInHost);
  const currentBranch = useRepoStore(s => s.currentBranch);
  const publishBranch = useRepoStore(s => s.publishBranch);
  const openRightPanel = useUiStore(s => s.openRightPanel);

  const run = async <T>(fn: () => Promise<T>, opts: GitActionOptions<T>): Promise<boolean> => {
    try {
      const result = await fn();
      const message = typeof opts.success === 'function' ? opts.success(result) : opts.success;
      if (message) {
        addToast({ variant: 'success', title: opts.successTitle ?? opts.title, message });
      }
      return true;
    } catch (err: unknown) {
      // Both conflict errors mean a dedicated modal is already on screen:
      // neither a success nor an error toast belongs next to it.
      if (err instanceof CheckoutConflictError || err instanceof MergeConflictError) return false;
      const raw = errorMessage(err);
      const { kind, action } = classifyGitError(err);
      const friendly = t(`error.${kind}`);
      const publishLabel = t('sync:publishBranch');
      addToast({
        variant: 'error',
        title: opts.title,
        message: friendly || raw,
        // The friendly line hides git's own words; the log has them in full.
        details: {
          label: t('logs:showInLogs'),
          onClick: () => {
            useLogStore.getState().focusLatestError();
            openRightPanel('logs');
          },
        },
        action:
          action === 'publishBranch' && currentBranch
            ? {
                label: publishLabel,
                onClick: () =>
                  void run(publishBranch, {
                    title: t('sync:failed', { op: publishLabel }),
                    successTitle: publishLabel,
                    success: t('sync:success', { op: publishLabel }),
                  }),
              }
            : action === 'signIn' && signInHost
              ? { label: t('signIn'), onClick: () => void openSignIn(signInHost) }
              : undefined,
      });
      return false;
    }
  };

  return run;
}
