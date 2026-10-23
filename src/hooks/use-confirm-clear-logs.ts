import { useTranslation } from 'react-i18next';
import { useLogStore } from '../stores/log-store';
import { useUiStore } from '../stores/ui-store';

export function useConfirmClearLogs() {
  const { t } = useTranslation('logs');
  const requestConfirm = useUiStore(s => s.requestConfirm);
  const clear = useLogStore(s => s.clear);

  return async (): Promise<boolean> => {
    const ok = await requestConfirm({
      title: t('settings.clearTitle'),
      message: t('settings.clearMessage'),
      confirmLabel: t('settings.clearConfirm'),
      danger: true,
    });
    if (!ok) return false;
    await clear().catch(() => {});
    return true;
  };
}
