import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore, type RightPanelTab } from '../../stores/ui-store';
import { useLogStore } from '../../stores/log-store';
import { useResizableWidth } from '../../hooks/use-resizable-width';
import { DiscardIcon, IconButton, ResizeHandle, SegmentedControl } from '../../shared/ui';
import { LogsView } from './LogsView';
import { TerminalView } from './TerminalView';

/** Tools docked on the right of the content: the operation log and the terminal. */
export function RightPanel() {
  const { t } = useTranslation('logs');
  const { t: tt } = useTranslation('terminal');
  const tab = useUiStore(s => s.rightPanel);
  const openRightPanel = useUiStore(s => s.openRightPanel);
  const close = useUiStore(s => s.closeRightPanel);
  const markRead = useLogStore(s => s.markRead);
  const terminalMounted = useUiStore(s => s.terminalMounted);
  const { width, startResize } = useResizableWidth('right-panel-width', 280, 900, 420, 'left');

  useEffect(() => {
    if (tab === 'logs') markRead();
  }, [tab, markRead]);

  if (!tab) return null;

  return (
    <>
      <ResizeHandle label={t('resize')} onMouseDown={startResize} />
      <aside
        style={{ width }}
        aria-label={tab === 'logs' ? t('title') : tt('title')}
        onKeyDown={e => {
          // The terminal needs Escape for itself (vim, less, fzf).
          if (e.key === 'Escape' && tab === 'logs') close();
        }}
        className="shrink-0 flex flex-col bg-mantle border-l border-surface0 overflow-hidden"
      >
        <div className="flex items-center gap-1 px-2 h-9 border-b border-surface0 shrink-0">
          <SegmentedControl<RightPanelTab>
            label={t('panel')}
            value={tab}
            onChange={openRightPanel}
            options={[
              { value: 'logs', label: t('title') },
              { value: 'terminal', label: tt('title') },
            ]}
          />
          <div className="flex-1" />
          <IconButton
            icon={DiscardIcon}
            onClick={close}
            aria-label={t('close')}
            title={t('close')}
          />
        </div>
        <div className={tab === 'logs' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
          <LogsView />
        </div>
        {terminalMounted && (
          <div className={tab === 'terminal' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
            <TerminalView visible={tab === 'terminal'} />
          </div>
        )}
      </aside>
    </>
  );
}
