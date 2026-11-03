import { useTranslation } from 'react-i18next';
import { useLogStore, type ClearScope } from '../stores/log-store';
import { useUiStore } from '../stores/ui-store';

const TEXT: Record<ClearScope, { title: string; message: string }> = {
  all: { title: 'settings.clearTitle', message: 'settings.clearAllMessage' },
  repo: { title: 'settings.clearTitle', message: 'settings.clearMessage' },
  app: { title: 'settings.clearAppTitle', message: 'settings.clearAppMessage' },
};

export function useConfirmClearLogs(scope: ClearScope = 'all') {
  const { t } = useTranslation('logs');
  const requestConfirm = useUiStore(s => s.requestConfirm);
  const clear = useLogStore(s => s.clear);

  return async (): Promise<boolean> => {
    const ok = await requestConfirm({
      title: t(TEXT[scope].title),
      message: t(TEXT[scope].message),
      confirmLabel: t('settings.clearConfirm'),
      danger: true,
    });
    if (!ok) return false;
    await clear(scope).catch(() => {});
    return true;
  };
}
