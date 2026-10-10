import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../stores/ui-store';
import { IconButton, SettingsIcon, InfoIcon } from '../../shared/ui';
import type { OverlayView } from '../../types';

/**
 * The titlebar's way to Settings and About: shows which page is open and
 * closes it on a second click, like the panel toggles in the footer.
 */
export function AppMenuButtons() {
  const { t } = useTranslation('common');
  const activeView = useUiStore(s => s.activeView);
  const openOverlayView = useUiStore(s => s.openOverlayView);
  const closeOverlays = useUiStore(s => s.closeOverlays);

  const button = (view: OverlayView, icon: typeof SettingsIcon, label: string) => {
    const active = activeView === view;
    return (
      <IconButton
        icon={icon}
        active={active}
        onClick={() => (active ? closeOverlays() : openOverlayView(view))}
        aria-label={label}
        title={label}
      />
    );
  };

  return (
    <div className="flex items-center gap-1">
      {button('about', InfoIcon, t('about'))}
      {button('settings', SettingsIcon, t('settings'))}
    </div>
  );
}
