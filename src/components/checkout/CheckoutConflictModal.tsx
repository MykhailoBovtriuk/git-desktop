import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { Button, Modal } from '../../shared/ui';

export function CheckoutConflictModal() {
  const { t } = useTranslation('checkout');
  const {
    checkoutConflict,
    stashAndCheckout,
    migrateCheckout,
    forceCheckout,
    cancelCheckout,
  } = useRepoStore(
    useShallow(s => ({
      checkoutConflict: s.checkoutConflict,
      stashAndCheckout: s.stashAndCheckout,
      migrateCheckout: s.migrateCheckout,
      forceCheckout: s.forceCheckout,
      cancelCheckout: s.cancelCheckout,
    })),
  );
  const { addToast } = useUiStore(useShallow(s => ({ addToast: s.addToast })));

  if (!checkoutConflict) return null;
  const { branch } = checkoutConflict;

  const run = (action: () => Promise<void>, successMsg: string) => async () => {
    try {
      await action();
      addToast({ variant: 'success', title: t('common:done'), message: successMsg });
    } catch (err: unknown) {
      addToast({
        variant: 'error',
        title: t('checkoutFailed'),
        message: err instanceof Error ? err.message : String(err),
      });
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
          <Button variant="primary" fullWidth onClick={run(stashAndCheckout, t('stashedSwitched', { branch }))}>
            {t('stashAction')}
          </Button>
        </div>

        <div>
          <p className="text-subtext text-xs mb-1">{t('migrateDesc', { branch })}</p>
          <Button variant="neutral" fullWidth onClick={run(migrateCheckout, t('migrated', { branch }))}>
            {t('migrateAction')}
          </Button>
        </div>

        <div>
          <p className="text-subtext text-xs mb-1">{t('forceDesc')}</p>
          <Button variant="danger" fullWidth onClick={run(forceCheckout, t('forced', { branch }))}>
            {t('forceAction')}
          </Button>
        </div>

        <Button variant="secondary" fullWidth onClick={cancelCheckout}>
          {t('common:cancel')}
        </Button>
      </div>
    </Modal>
  );
}
