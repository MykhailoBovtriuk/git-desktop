import { useTranslation } from 'react-i18next';
import { useUiStore } from '../stores/ui-store';
import { CheckoutConflictError } from '../stores/repo-store';
import { classifyGitError } from '../lib/git-error-mapper';

interface GitActionOptions {
  // Toast title for both outcomes (usually the operation name).
  title: string;
  // Success toast message; omit for silent success (e.g. staging a file —
  // the list updating IS the feedback).
  success?: string;
}

// Single place where git-action failures become user feedback: classify the
// raw stderr into a friendly translated message (footer:error.* covers all
// kinds), fall back to the raw text for unknown errors. Without this wrapper
// onClick={() => storeAction()} rejections vanish silently.
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
      // checkout() has already surfaced its own conflict modal — a toast on
      // top of it would be noise.
      if (err instanceof CheckoutConflictError) return false;
      const raw = err instanceof Error ? err.message : String(err);
      const { kind } = classifyGitError(err);
      const friendly = t(`error.${kind}`);
      addToast({ variant: 'error', title: opts.title, message: friendly || raw });
      return false;
    }
  };
}
