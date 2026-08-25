import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useUiStore } from '../stores/ui-store';
import { CheckoutConflictError } from '../stores/repo-store';
import { classifyGitError } from '../lib/git-error-mapper';

interface GitActionOptions {
  title: string;
  success?: string;
}

export function useGitAction() {
  const { t } = useTranslation('footer');
  const { addToast, openOverlayView } = useUiStore(
    useShallow(s => ({ addToast: s.addToast, openOverlayView: s.openOverlayView })),
  );

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
        // An auth failure is a dead end without somewhere to go: send the user
        // to the settings section that explains this repository's setup.
        action:
          action === 'credentialHelp'
            ? { label: t('fixAuth'), onClick: () => openOverlayView('settings-account', 'auth') }
            : undefined,
      });
      return false;
    }
  };
}
