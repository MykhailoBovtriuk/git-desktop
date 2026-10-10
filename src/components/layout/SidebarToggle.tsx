import { useTranslation } from 'react-i18next';
import { useUiStore, isOverlayView } from '../../stores/ui-store';
import { shortcutLabel } from '../../lib/keyboard';
import { useShortcut } from '../../hooks/use-shortcut';
import { GitLogoIcon, cn } from '../../shared/ui';

/** Git's own orange: the logo is shown in its colours while the sidebar is on. */
const GIT_ORANGE = '#F05032';

/** The footer's left corner: the Git logo shows and hides the left column. */
export function SidebarToggle() {
  const { t } = useTranslation('common');
  // Under Settings/About the sidebar is not on screen, whatever the flag says.
  const open = useUiStore(s => s.sidebarOpen && !isOverlayView(s.activeView));
  const toggleSidebar = useUiStore(s => s.toggleSidebar);
  const shortcut = shortcutLabel('B');
  // Ctrl+B moves the cursor back in a shell and is tmux's prefix; useShortcut
  // leaves it to the terminal there.
  useShortcut({ key: 'b', mod: 'cmd-or-ctrl' }, () => useUiStore.getState().toggleSidebar());

  const label = t(open ? 'hideSidebar' : 'showSidebar', { shortcut });

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-pressed={open}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded p-1 transition-colors hover:bg-surface1',
        !open && 'text-subtext hover:text-text',
      )}
      style={open ? { color: GIT_ORANGE } : undefined}
    >
      <GitLogoIcon size={16} aria-hidden="true" />
    </button>
  );
}
