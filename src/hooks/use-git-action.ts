import { useTranslation } from 'react-i18next';
import { useUiStore } from '../stores/ui-store';
import { CheckoutConflictError } from '../stores/repo-store';
import { classifyGitError } from '../lib/git-error-mapper';

interface GitActionOptions {
  title: string;
  success?: string;
}

export function useGitAction() {
  const { t } = useTranslation('footer');
  const addToast = useUiStore(s => s.addToast);

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
      const { kind } = classifyGitError(err);
      const friendly = t(`error.${kind}`);
      addToast({ variant: 'error', title: opts.title, message: friendly || raw });
      return false;
    }
  };
}
