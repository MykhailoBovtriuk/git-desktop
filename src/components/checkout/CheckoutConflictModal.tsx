import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useGitAction } from '../../hooks/use-git-action';
import { useBusy } from '../../hooks/use-busy';
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
  const runAction = useGitAction();
  const [busy, track] = useBusy();

  if (!checkoutConflict) return null;
  const { branch } = checkoutConflict;

  const run = (action: () => Promise<void>, successMsg: string) => () =>
    track(() =>
      runAction(action, {
        title: t('checkoutFailed'),
        successTitle: t('common:done'),
        success: successMsg,
      }),
    );

  return (
    <Modal
      title={t('title')}
      titleVariant="danger"
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
