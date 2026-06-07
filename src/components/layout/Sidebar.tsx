import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { Accordion } from '../../shared/ui';
import { ChangesSection } from '../staging/ChangesSection';
import { StashSection } from '../stash/StashSection';

const MIN_WIDTH = 224;
const MAX_WIDTH = 480;

function loadWidth(): number {
  const saved = Number(localStorage.getItem('sidebar-width'));
  return saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : MIN_WIDTH;
}

export function Sidebar() {
  const { t } = useTranslation();
  const { status, stashes } = useRepoStore();
  const { activeView, setActiveView } = useUiStore();

  const [width, setWidth] = useState(loadWidth);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) =>
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ev.clientX)));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      setWidth(w => { localStorage.setItem('sidebar-width', String(w)); return w; });
    };
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const totalChanges = status.staged.length + status.unstaged.length;
  const stashOpen = activeView === 'stash' || activeView === 'stash-create';
  const listMode = activeView === 'stash';

  return (
    <div
      className="relative bg-mantle border-r border-surface0 flex flex-col overflow-hidden shrink-0"
      style={{ width }}
    >

      {/* Changes accordion — flex-1 when stash is closed */}
      <div className={`flex flex-col min-h-0 overflow-hidden ${activeView === 'changes' ? 'flex-1' : 'shrink-0'}`}>
        <Accordion
          title="Changes"
          badge={totalChanges}
          open={activeView === 'changes'}
          onToggle={() => setActiveView(activeView === 'changes' ? 'diff' : 'changes')}
        >
          <ChangesSection />
        </Accordion>
      </div>

      {/* Stash accordion — flex-1 when open */}
      <div className={`flex flex-col min-h-0 overflow-hidden border-t-2 border-surface1 ${stashOpen ? 'flex-1' : 'shrink-0'}`}>
        <Accordion
          title={t('stash:title')}
          badge={!stashOpen && stashes.length > 0 ? `${t('stash:list')} · ${stashes.length}` : undefined}
          open={stashOpen}
          indicateOpen={stashOpen && !listMode}
          onToggle={() => setActiveView(stashOpen ? 'diff' : 'stash-create')}
          action={listMode ? (
            <button
              type="button"
              aria-label={t('stash:list')}
              aria-pressed
              onClick={() => setActiveView('stash-create')}
              className="flex items-center gap-1.5 px-1 py-0.5 hover:opacity-80 transition-colors"
            >
              <span className="relative inline-flex h-3.5 w-6 items-center rounded-full bg-blue transition-colors duration-200">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm translate-x-3 transition-transform duration-200" />
              </span>
              <span className="text-xs text-subtext">{t('stash:list')}</span>
            </button>
          ) : undefined}
        >
          <StashSection />
        </Accordion>
      </div>

      <div className="border-t-2 border-surface1 shrink-0" />

      {/* History + Graph */}
      <div className="flex flex-col shrink-0 mt-auto">
        <button
          onClick={() => setActiveView('history')}
          className={`flex items-center w-full px-3 py-2 text-left border-l-2 transition-colors text-xs font-semibold uppercase tracking-wide ${activeView === 'history' ? 'bg-surface0 border-blue text-text' : 'border-transparent hover:bg-surface0 text-subtext hover:text-text'}`}
        >
          History
        </button>
        <div className="border-t border-surface0" />
        <button
          onClick={() => setActiveView('graph')}
          className={`flex items-center w-full px-3 py-2 text-left border-l-2 transition-colors text-xs font-semibold uppercase tracking-wide ${activeView === 'graph' ? 'bg-surface0 border-blue text-text' : 'border-transparent hover:bg-surface0 text-subtext hover:text-text'}`}
        >
          Graph
        </button>
      </div>

      {/* Drag handle to resize the sidebar */}
      <div
        onMouseDown={startResize}
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue/40 active:bg-blue/60 transition-colors z-10"
      />
    </div>
  );
}
