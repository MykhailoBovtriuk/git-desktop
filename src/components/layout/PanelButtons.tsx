import { useTranslation } from 'react-i18next';
import { useUiStore, isOverlayView, type RightPanelTab } from '../../stores/ui-store';
import { useLogStore } from '../../stores/log-store';
import { shortcutLabel } from '../../lib/keyboard';
import { useShortcut } from '../../hooks/use-shortcut';
import { IconButton, LogsIcon, TerminalIcon, cn } from '../../shared/ui';

/**
 * Over Settings/About a panel button leaves the page and shows the panel: it
 * sits hidden there, and toggling it would look like the button did nothing.
 */
function showPanel(tab: RightPanelTab) {
  const ui = useUiStore.getState();
  if (isOverlayView(ui.activeView)) {
    ui.closeOverlays();
    ui.openRightPanel(tab);
  } else {
    ui.toggleRightPanel(tab);
  }
}

export function PanelButtons({ logsOnly = false }: { logsOnly?: boolean }) {
  const { t } = useTranslation('logs');
  const { t: tt } = useTranslation('terminal');
  const rightPanel = useUiStore(s => s.rightPanel);
  const overlayOpen = useUiStore(s => isOverlayView(s.activeView));
  const unread = useLogStore(s => s.unreadProblems);
  const hasError = useLogStore(s => s.unreadHasError);
  const shortcut = shortcutLabel('J');
  useShortcut({ key: 'j', mod: 'cmd-or-ctrl' }, () => showPanel('logs'));
  useShortcut({ code: 'Backquote', mod: 'ctrl' }, () => !logsOnly && showPanel('terminal'));

  const logsOpen = !overlayOpen && rightPanel === 'logs';
  const terminalOpen = !overlayOpen && rightPanel === 'terminal';
  const logsLabel = unread
    ? `${t('toggle', { shortcut })} · ${t('unread', { count: unread })}`
    : t('toggle', { shortcut });

  return (
    <div className="flex items-center gap-1">
      <span className="relative inline-flex">
        <IconButton
          icon={LogsIcon}
          active={logsOpen}
          onClick={() => showPanel('logs')}
          aria-label={logsLabel}
          title={logsLabel}
        />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-0.5 right-0.5 w-2 h-2 rounded-full pointer-events-none',
              hasError ? 'bg-red' : 'bg-yellow',
            )}
          />
        )}
      </span>
      {!logsOnly && (
        <IconButton
          icon={TerminalIcon}
          active={terminalOpen}
          onClick={() => showPanel('terminal')}
          aria-label={tt('toggle', { shortcut: 'Ctrl+`' })}
          title={tt('toggle', { shortcut: 'Ctrl+`' })}
        />
      )}
    </div>
  );
}
