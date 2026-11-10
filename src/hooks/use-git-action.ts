import { useTranslation } from 'react-i18next';
import { useUiStore } from '../stores/ui-store';
import { useAccountStore } from '../stores/account-store';
import { requestOrgAccess, showInLogs } from '../stores/error-toast';
import { CheckoutConflictError, MergeConflictError, useRepoStore } from '../stores/repo-store';
import { selectSignInHost } from '../stores/repo/selectors';
import { classifyGitError, type GitErrorAction } from '../lib/git-error-mapper';
import { errorLogId, errorMessage } from '../lib/error-message';
import { logApi } from '../api/log-api';
import type { Toast } from '../types';

interface GitActionOptions<T> {
  title: string;
  successTitle?: string;
  success?: string | ((result: T) => string);
}

export function useGitAction() {
  const { t } = useTranslation('footer');
  const addToast = useUiStore(s => s.addToast);
  const openSignIn = useAccountStore(s => s.openSignIn);
  const authSource = useAccountStore(s => s.authSource);
  const signInHost = useRepoStore(selectSignInHost);
  const repoPath = useRepoStore(s => s.repoPath);
  const currentBranch = useRepoStore(s => s.currentBranch);
  const publishBranch = useRepoStore(s => s.publishBranch);

  function toastAction(action: GitErrorAction | undefined): Toast['action'] {
    if (action === 'publishBranch' && currentBranch) {
      const publishLabel = t('sync:publishBranch');
      return {
        label: publishLabel,
        onClick: () =>
          void run(publishBranch, {
            title: t('sync:failed', { op: publishLabel }),
            successTitle: publishLabel,
            success: t('sync:success', { op: publishLabel }),
          }),
      };
    }
    if (action === 'signIn' && signInHost && repoPath) {
      return { label: t('signIn'), onClick: () => void openSignIn(signInHost, repoPath) };
    }
    if (action === 'requestOrgAccess') {
      return {
        label: t('requestAccess'),
        onClick: () => requestOrgAccess(repoPath, t('requestAccessFailed')),
      };
    }
    return undefined;
  }

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
      const { kind, action } = classifyGitError(err, { host: signInHost, authSource });
      const logId = errorLogId(err);
      if (kind === 'orgAccess' && logId) void logApi.markKind(logId, kind);
      const friendly = t(`error.${kind}`);
      addToast({
        variant: 'error',
        title: opts.title,
        message: friendly || raw,
        details: showInLogs(err),
        action: toastAction(action),
      });
      return false;
    }
  };

  return run;
}
