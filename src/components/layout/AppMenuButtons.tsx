import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../stores/ui-store';
import { IconButton, SettingsIcon, InfoIcon } from '../../shared/ui';

export function AppMenuButtons() {
  const { t } = useTranslation('common');
  const openOverlayView = useUiStore(s => s.openOverlayView);

  return (
    <div className="flex items-center gap-1">
      <IconButton
        icon={SettingsIcon}
        onClick={() => openOverlayView('settings')}
        aria-label={t('settings')}
        title={t('settings')}
      />
      <IconButton
        icon={InfoIcon}
        onClick={() => openOverlayView('about')}
        aria-label={t('about')}
        title={t('about')}
      />
    </div>
  );
}
