import { useTranslation } from 'react-i18next';
import { useUiStore, isOverlayView } from '../../stores/ui-store';
import { shortcutLabel } from '../../lib/keyboard';
import { useShortcut } from '../../hooks/use-shortcut';
import { GitLogoIcon, IconButton } from '../../shared/ui';

export function SidebarToggle() {
  const { t } = useTranslation('common');
  const open = useUiStore(s => s.sidebarOpen && !isOverlayView(s.activeView));
  const toggleSidebar = useUiStore(s => s.toggleSidebar);
  const shortcut = shortcutLabel('B');
  // Ctrl+B moves the cursor back in a shell and is tmux's prefix; useShortcut
  // leaves it to the terminal there.
  useShortcut({ key: 'b', mod: 'cmd-or-ctrl' }, () => useUiStore.getState().toggleSidebar());

  const label = t(open ? 'hideSidebar' : 'showSidebar', { shortcut });

  return (
    <IconButton
      type="button"
      icon={GitLogoIcon}
      tint={open ? 'git' : 'subtext'}
      onClick={toggleSidebar}
      aria-pressed={open}
      aria-label={label}
      title={label}
    />
  );
}
