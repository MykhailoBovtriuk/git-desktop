import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { Accordion, ResizeHandle, Switch } from '../../shared/ui';
import { ChangesSection } from '../staging/ChangesSection';
import { StashSection } from '../stash/StashSection';
import { useResizableWidth } from '../../hooks/use-resizable-width';

export function Sidebar() {
  const { t } = useTranslation();
  const { status, stashes } = useRepoStore(
    useShallow(s => ({ status: s.status, stashes: s.stashes })),
  );
  const { activeView, setActiveView } = useUiStore(
    useShallow(s => ({ activeView: s.activeView, setActiveView: s.setActiveView })),
  );

  const { width, startResize } = useResizableWidth('sidebar-width', 224, 480);

  const totalChanges = status.staged.length + status.unstaged.length;
  const stashOpen = activeView === 'stash' || activeView === 'stash-create';
  const listMode = activeView === 'stash';

  return (
    <>
      <div
        className="bg-mantle border-r border-surface0 flex flex-col overflow-hidden shrink-0 select-none"
        style={{ width }}
      >
        <div
          className={`flex flex-col min-h-0 overflow-hidden ${activeView === 'changes' ? 'flex-1' : 'shrink-0'}`}
        >
          <Accordion
            title={t('staging:changes')}
            badge={totalChanges}
            open={activeView === 'changes'}
            onToggle={() => setActiveView(activeView === 'changes' ? 'diff' : 'changes')}
          >
            <ChangesSection />
          </Accordion>
        </div>

        <div
          className={`flex flex-col min-h-0 overflow-hidden border-t-2 border-surface1 ${stashOpen ? 'flex-1' : 'shrink-0'}`}
        >
          <Accordion
            title={t('stash:title')}
            badge={
              !stashOpen && stashes.length > 0
                ? `${t('stash:list')} · ${stashes.length}`
                : undefined
            }
            open={stashOpen}
            indicateOpen={stashOpen && !listMode}
            onToggle={() => setActiveView(stashOpen ? 'diff' : 'stash-create')}
            action={
              listMode ? (
                <Switch
                  checked
                  onToggle={() => setActiveView('stash-create')}
                  label={t('stash:list')}
                  className="px-1 py-0.5"
                />
              ) : undefined
            }
          >
            <StashSection />
          </Accordion>
        </div>

        <div className="border-t-2 border-surface1 shrink-0" />

        <div className="flex flex-col shrink-0 mt-auto">
          <button
            onClick={() => setActiveView('history')}
            className={`flex items-center w-full px-3 py-2 text-left border-l-2 transition-colors text-xs font-semibold uppercase tracking-wide ${activeView === 'history' ? 'bg-surface0 border-blue text-text' : 'border-transparent hover:bg-surface0 text-subtext hover:text-text'}`}
          >
            {t('history')}
          </button>
          <div className="border-t border-surface0" />
          <button
            onClick={() => setActiveView('graph')}
            className={`flex items-center w-full px-3 py-2 text-left border-l-2 transition-colors text-xs font-semibold uppercase tracking-wide ${activeView === 'graph' ? 'bg-surface0 border-blue text-text' : 'border-transparent hover:bg-surface0 text-subtext hover:text-text'}`}
          >
            {t('graph')}
          </button>
        </div>
      </div>

      <ResizeHandle label={t('resizeSidebar')} onMouseDown={startResize} />
    </>
  );
}
