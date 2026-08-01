import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useGitAction } from '../../hooks/use-git-action';
import { Button, Modal } from '../../shared/ui';

export function CheckoutConflictModal() {
  const { t } = useTranslation('checkout');
  const { checkoutConflict, stashAndCheckout, migrateCheckout, forceCheckout, cancelCheckout } =
    useRepoStore(
      useShallow(s => ({
        checkoutConflict: s.checkoutConflict,
        stashAndCheckout: s.stashAndCheckout,
        migrateCheckout: s.migrateCheckout,
        forceCheckout: s.forceCheckout,
        cancelCheckout: s.cancelCheckout,
      })),
    );
  const { addToast } = useUiStore(useShallow(s => ({ addToast: s.addToast })));
  const runAction = useGitAction();
  // All three actions are mutually exclusive and must not double-fire on a
  // double click — one busy flag disables the whole button group.
  const [busy, setBusy] = useState(false);

  if (!checkoutConflict) return null;
  const { branch } = checkoutConflict;

  const run = (action: () => Promise<void>, successMsg: string) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await runAction(action, { title: t('checkoutFailed') });
      if (ok) addToast({ variant: 'success', title: t('common:done'), message: successMsg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('title')}
      titleVariant="danger"
      level="high"
      width="w-[75%] max-w-xl"
      subtitle={t('subtitle', { branch })}
      onClose={cancelCheckout}
    >
      <div className="flex flex-col gap-3 mt-2">
        <div>
          <p className="text-subtext text-xs mb-1">{t('stashDesc')}</p>
          <Button
            variant="primary"
            fullWidth
            disabled={busy}
            onClick={run(stashAndCheckout, t('stashedSwitched', { branch }))}
          >
            {t('stashAction')}
          </Button>
        </div>

        <div>
          <p className="text-subtext text-xs mb-1">{t('migrateDesc', { branch })}</p>
          <Button
            variant="neutral"
            fullWidth
            disabled={busy}
            onClick={run(migrateCheckout, t('migrated', { branch }))}
          >
            {t('migrateAction')}
          </Button>
        </div>

        <div>
          <p className="text-subtext text-xs mb-1">{t('forceDesc')}</p>
          <Button
            variant="danger"
            fullWidth
            disabled={busy}
            onClick={run(forceCheckout, t('forced', { branch }))}
          >
            {t('forceAction')}
          </Button>
        </div>

        <Button variant="secondary" fullWidth disabled={busy} onClick={cancelCheckout}>
          {t('common:cancel')}
        </Button>
      </div>
    </Modal>
  );
}
